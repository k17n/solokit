import { describe, expect, it } from 'vitest';
import { StorageError, createMemoryStore } from '@solokit/storage';
import { MAX_BACKUP_BYTES, compareWithDevice, createBackup, inspectBackup, isBackupDue, recordBackup, restoreBackup } from './backup';
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
    const settings = parsed.collections.settings?.[0] as unknown as { lastBackupAt?: string };
    expect(settings.lastBackupAt).toBe('2026-10-14T12:00:00.000Z');
  });

  it('does not mark the device as backed up until recordBackup is called', async () => {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => NOW });
    await storage.invoices.save(makeInvoice());
    await createBackup(store, NOW);
    expect((await storage.settings.get()).lastBackupAt).toBeUndefined();
    await recordBackup(store, NOW);
    expect((await storage.settings.get()).lastBackupAt).toBe('2026-10-14T12:00:00.000Z');
  });

  it('leaves the backup time alone when the export fails', async () => {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => NOW });
    await storage.settings.update({ lastBackupAt: '2026-09-01T00:00:00.000Z' });
    const failing = { ...store, exportAll: () => Promise.reject(new Error('boom')) };
    await expect(createBackup(failing, NOW)).rejects.toThrow('boom');
    expect((await storage.settings.get()).lastBackupAt).toBe('2026-09-01T00:00:00.000Z');
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

describe('stricter restore validation', () => {
  async function sample() {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => NOW });
    await storage.profile.save(makeSeller());
    await storage.clients.save(makeClient());
    await storage.invoices.save(makeInvoice());
    await storage.themes.save({ id: 't1', name: 'Mine', layout: 'modern', accent: '#047857', text: '#14213D', background: '#FFFFFF', fontId: 'inter' });
    await storage.settings.update({ onboarded: true });
    return JSON.parse((await createBackup(store, NOW)).json);
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const damage: [string, (backup: any) => void][] = [
    ['profile without a name', (b) => delete b.collections.profile[0].name],
    ['profile without an address', (b) => delete b.collections.profile[0].address],
    ['profile with a text address', (b) => (b.collections.profile[0].address = 'Mumbai')],
    ['settings without a theme id', (b) => delete b.collections.settings[0].defaultThemeId],
    ['settings with a non-boolean onboarded', (b) => (b.collections.settings[0].onboarded = 'yes')],
    ['theme with an unknown layout', (b) => (b.collections.themes[0].layout = 'fancy')],
    ['theme that takes over a preset id', (b) => (b.collections.themes[0].id = 'modern')],
    ['invoice lines that are not a list', (b) => (b.collections.invoices[0].lines = {})],
    ['invoice seller without an address', (b) => delete b.collections.invoices[0].seller.address],
    ['invoice client without an address', (b) => delete b.collections.invoices[0].client.address],
    ['invoice with a damaged theme snapshot', (b) => (b.collections.invoices[0].themeSnapshot = { name: 'x' })],
  ];
  /* eslint-enable @typescript-eslint/no-explicit-any */

  it.each(damage)('refuses a backup with %s and changes nothing', async (_name, mutate) => {
    const backup = await sample();
    mutate(backup);
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => NOW });
    await storage.invoices.save(makeInvoice({ id: 'keep' }));
    await expect(restoreBackup(store, JSON.stringify(backup))).rejects.toBeInstanceOf(StorageError);
    expect(() => inspectBackup(JSON.stringify(backup))).toThrow(StorageError);
    expect((await storage.invoices.list()).map((invoice) => invoice.id)).toEqual(['keep']);
    expect(await storage.profile.get()).toBeUndefined();
  });

  it('accepts an undamaged backup', async () => {
    expect(inspectBackup(JSON.stringify(await sample())).invoices).toBe(1);
  });

  it('explains that a newer backup needs a newer app', async () => {
    const store = createMemoryStore();
    const text = JSON.stringify({ version: 2, exportedAt: 'x', collections: {} });
    expect(() => inspectBackup(text)).toThrow(/newer version of SoloKit.*update the app/i);
    await expect(restoreBackup(store, text)).rejects.toThrow(/newer version of SoloKit/);
  });

  it('refuses a file over the size limit', () => {
    expect(() => inspectBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow(/too large/i);
  });
});

describe('compareWithDevice', () => {
  it('names invoices on the device that the file lacks and says when the file is older', async () => {
    const earlier = new Date('2026-10-01T00:00:00.000Z');
    const source = createMemoryStore();
    await createInvoiceStorage(source, { now: () => earlier }).invoices.save(makeInvoice({ id: 'a', number: '2026-27/0001' }));
    const file = (await createBackup(source, earlier)).json;

    const device = createMemoryStore();
    const deviceStorage = createInvoiceStorage(device, { now: () => NOW });
    await deviceStorage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0001' }));
    await deviceStorage.invoices.save(makeInvoice({ id: 'b', number: '2026-27/0002' }));
    await deviceStorage.invoices.save(makeInvoice({ id: 'c', number: '2026-27/0003', status: 'draft' }));

    const result = await compareWithDevice(device, file);
    expect(result.missing.map((invoice) => invoice.number)).toEqual(['2026-27/0002', '2026-27/0003']);
    expect(result.missingIssued).toBe(1);
    expect(result.reusableNumbers).toEqual(['2026-27/0002']);
    expect(result.fileIsOlder).toBe(true);
  });

  it('reports nothing for a file that already holds everything and is newer', async () => {
    const device = createMemoryStore();
    await createInvoiceStorage(device, { now: () => new Date('2026-10-01T00:00:00.000Z') }).invoices.save(makeInvoice({ id: 'a' }));
    const snapshot = JSON.parse((await createBackup(device, NOW)).json);
    snapshot.exportedAt = '2026-10-20T00:00:00.000Z';
    expect(await compareWithDevice(device, JSON.stringify(snapshot))).toEqual({ missing: [], missingIssued: 0, reusableNumbers: [], fileIsOlder: false });
  });
});
