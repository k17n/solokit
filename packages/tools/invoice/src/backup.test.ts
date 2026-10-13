import { describe, expect, it } from 'vitest';
import { StorageError, createMemoryStore } from '@solokit/storage';
import { createBackup, isBackupDue, restoreBackup } from './backup';
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
