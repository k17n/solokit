import { describe, expect, it } from 'vitest';
import { StorageError, createMemoryStore } from '@solokit/storage';
import { createBackup, inspectBackup, isBackupDue, restoreBackup } from './backup';
import { createInvoiceStorage } from './repositories';
import { makeClient, makeInvoice, makeSeller } from './testing';

const NOW = new Date('2026-10-14T12:00:00.000Z');

describe('createBackup', () => {
  it('exports everything as dated JSON and records the backup time', async () => {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => NOW });
    await storage.profile.save(makeSeller());
    await storage.clients.save(makeClient());
    await storage.invoices.save(makeInvoice());

    const backup = await createBackup(store, NOW);
    expect(backup.filename).toBe('solokit-backup-2026-10-14.json');
    const parsed = JSON.parse(backup.json) as { version: number; collections: Record<string, { id: string }[]> };
    expect(parsed.version).toBe(1);
    expect(parsed.collections.invoices?.map((record) => record.id)).toEqual(['inv-1']);
    expect(parsed.collections.profile?.[0]?.id).toBe('me');
    expect((await storage.settings.get()).lastBackupAt).toBe('2026-10-14T12:00:00.000Z');
  });
});

describe('restoreBackup', () => {
  it('restores a backup into another store, replacing what was there', async () => {
    const source = createMemoryStore();
    const sourceStorage = createInvoiceStorage(source, { now: () => NOW });
    await sourceStorage.profile.save(makeSeller({ name: 'From backup' }));
    await sourceStorage.invoices.save(makeInvoice({ id: 'kept' }));
    const { json } = await createBackup(source, NOW);

    const target = createMemoryStore();
    const targetStorage = createInvoiceStorage(target, { now: () => NOW });
    await targetStorage.invoices.save(makeInvoice({ id: 'will-be-replaced' }));
    await restoreBackup(target, json);

    expect((await targetStorage.profile.get())?.name).toBe('From backup');
    expect((await targetStorage.invoices.list()).map((invoice) => invoice.id)).toEqual(['kept']);
  });

  it('rejects text that is not a backup and leaves existing data alone', async () => {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => NOW });
    await storage.invoices.save(makeInvoice({ id: 'keep' }));

    await expect(restoreBackup(store, 'not json at all')).rejects.toBeInstanceOf(StorageError);
    await expect(restoreBackup(store, '{"hello":"world"}')).rejects.toBeInstanceOf(StorageError);
    await expect(restoreBackup(store, '')).rejects.toBeInstanceOf(StorageError);
    expect((await storage.invoices.list()).map((invoice) => invoice.id)).toEqual(['keep']);
  });
});

describe('isBackupDue', () => {
  it('is not due when there is nothing to lose', () => {
    expect(isBackupDue(undefined, NOW, false)).toBe(false);
  });

  it('is due when there is data and no backup yet', () => {
    expect(isBackupDue(undefined, NOW, true)).toBe(true);
  });

  it('is due only after the threshold has passed', () => {
    expect(isBackupDue('2026-10-01T00:00:00.000Z', NOW, true)).toBe(false);
    expect(isBackupDue('2026-09-14T12:00:00.000Z', NOW, true)).toBe(false);
    expect(isBackupDue('2026-09-14T11:59:59.000Z', NOW, true)).toBe(true);
    expect(isBackupDue('2026-10-07T00:00:00.000Z', NOW, true, 3)).toBe(true);
  });

  it('treats an unreadable date as due', () => {
    expect(isBackupDue('garbage', NOW, true)).toBe(true);
  });
});

describe('backup time and file handling', () => {
  it('records its own backup time inside the file, so a restore elsewhere shows the right date', async () => {
    const source = createMemoryStore();
    await createInvoiceStorage(source, { now: () => NOW }).invoices.save(makeInvoice());
    const { json } = await createBackup(source, NOW);

    const target = createMemoryStore();
    await restoreBackup(target, json);
    expect((await createInvoiceStorage(target).settings.get()).lastBackupAt).toBe('2026-10-14T12:00:00.000Z');
  });

  it('treats a restored file without a recorded time as backed up when it was exported', async () => {
    const source = createMemoryStore();
    await createInvoiceStorage(source, { now: () => NOW }).invoices.save(makeInvoice());
    const snapshot = await source.exportAll();
    const old = JSON.stringify({ ...snapshot, exportedAt: '2026-09-20T08:00:00.000Z' });

    const target = createMemoryStore();
    await restoreBackup(target, old);
    expect((await createInvoiceStorage(target).settings.get()).lastBackupAt).toBe('2026-09-20T08:00:00.000Z');
  });

  it('accepts a file that starts with a byte-order mark', async () => {
    const source = createMemoryStore();
    await createInvoiceStorage(source, { now: () => NOW }).invoices.save(makeInvoice({ id: 'bom' }));
    const { json } = await createBackup(source, NOW);
    const target = createMemoryStore();
    await restoreBackup(target, `\uFEFF${json}`);
    expect((await createInvoiceStorage(target).invoices.list()).map((invoice) => invoice.id)).toEqual(['bom']);
  });

  it('rejects arrays, null and a future file version without touching existing data', async () => {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => NOW });
    await storage.invoices.save(makeInvoice({ id: 'keep' }));
    for (const text of ['[]', 'null', '42', JSON.stringify({ version: 2, exportedAt: 'x', collections: {} })]) {
      await expect(restoreBackup(store, text)).rejects.toBeInstanceOf(StorageError);
    }
    expect((await storage.invoices.list()).map((invoice) => invoice.id)).toEqual(['keep']);
  });

  it('does not trust a backup time far in the future', () => {
    expect(isBackupDue('2027-01-01T00:00:00.000Z', NOW, true)).toBe(true);
    expect(isBackupDue('2026-10-15T00:00:00.000Z', NOW, true)).toBe(false);
  });
});

describe('inspectBackup', () => {
  async function sampleJson() {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => NOW });
    await storage.profile.save(makeSeller({ name: 'Summary Co' }));
    await storage.clients.save(makeClient());
    await storage.invoices.save(makeInvoice());
    await storage.themes.save({ id: 't1', name: 'Mine', layout: 'modern', accent: '#047857', text: '#14213D', background: '#FFFFFF', fontId: 'inter' });
    return (await createBackup(store, NOW)).json;
  }

  it('summarises what a backup holds without changing anything', async () => {
    const summary = inspectBackup(await sampleJson());
    expect(summary).toMatchObject({ invoices: 1, clients: 1, themes: 1, hasProfile: true, profileName: 'Summary Co', exportedAt: expect.any(String) });
  });

  it('accepts a file with a byte-order mark', async () => {
    expect(inspectBackup('﻿' + (await sampleJson())).invoices).toBe(1);
  });

  it('rejects files that are not backups', () => {
    for (const text of ['', 'nope', '[]', '{"version":2}', '{"version":1,"exportedAt":"x","collections":{"invoices":[{"id":"a"}]}}']) {
      expect(() => inspectBackup(text)).toThrow(StorageError);
    }
  });

  it('rejects themes with unusable colours or unknown fonts', async () => {
    const parsed = JSON.parse(await sampleJson());
    parsed.collections.themes[0].accent = 'red';
    expect(() => inspectBackup(JSON.stringify(parsed))).toThrow(/theme/i);
    parsed.collections.themes[0].accent = '#047857';
    parsed.collections.themes[0].fontId = 'comic-sans';
    expect(() => inspectBackup(JSON.stringify(parsed))).toThrow(/theme/i);
  });

  it('refuses to restore a file whose invoices are malformed, changing nothing', async () => {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => NOW });
    await storage.invoices.save(makeInvoice({ id: 'keep' }));
    const parsed = JSON.parse(await sampleJson());
    delete parsed.collections.invoices[0].lines;
    await expect(restoreBackup(store, JSON.stringify(parsed))).rejects.toBeInstanceOf(StorageError);
    expect((await storage.invoices.list()).map((invoice) => invoice.id)).toEqual(['keep']);
  });
});
