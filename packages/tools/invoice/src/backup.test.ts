import { describe, expect, it } from 'vitest';
import { StorageError, createMemoryStore, createWorkspaceManager } from '@solokit/storage';
import { MAX_BACKUP_BYTES, compareWithDevice, createBackup, inspectBackup, isBackupDue, recordBackup, restoreBackup, restoreIntoNewWorkspace } from './backup';
import { createContractStorage } from '@solokit/tool-contract';
import { makeContract } from '@solokit/tool-contract/testing';
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
    ['invoice of an unknown kind', (b) => (b.collections.invoices[0].kind = 'receipt')],
    ['invoice with a non-text valid-until date', (b) => (b.collections.invoices[0].validUntil = 20261113)],
    ['invoice with a non-text conversion link', (b) => (b.collections.invoices[0].convertedToId = 7)],
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

  it('accepts quotes, proformas and conversion links, and older backups without them', async () => {
    const backup = await sample();
    const old = backup.collections.invoices[0];
    delete old.kind;
    expect(inspectBackup(JSON.stringify(backup)).invoices).toBe(1);

    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => NOW });
    await storage.invoices.save(makeInvoice({ id: 'q', kind: 'quote', number: 'QT/2026-27/0001', validUntil: '2026-11-13', convertedToId: 'i' }));
    await storage.invoices.save(makeInvoice({ id: 'i', number: '2026-27/0001', status: 'draft', convertedFromId: 'q' }));
    const json = (await createBackup(store, NOW)).json;
    const target = createMemoryStore();
    await restoreBackup(target, json);
    const restored = createInvoiceStorage(target);
    expect(await restored.invoices.get('q')).toMatchObject({ kind: 'quote', validUntil: '2026-11-13', convertedToId: 'i' });
    expect(await restored.invoices.nextNumber('2026-10-20', 'quote')).toBe('QT/2026-27/0002');
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

  it('compares numbers per series, so a PF/QT document cannot hide a missing tax invoice', async () => {
    const earlier = new Date('2026-10-01T00:00:00.000Z');
    const source = createMemoryStore();
    const sourceStorage = createInvoiceStorage(source, { now: () => earlier });
    await sourceStorage.invoices.save(makeInvoice({ id: 'q', kind: 'quote', number: '2026-27/0002', validUntil: '2026-11-13' }));
    const file = (await createBackup(source, earlier)).json;

    const device = createMemoryStore();
    await createInvoiceStorage(device, { now: () => NOW }).invoices.save(makeInvoice({ id: 'b', number: '2026-27/0002' }));
    expect((await compareWithDevice(device, file)).reusableNumbers).toEqual(['2026-27/0002']);
  });

  it('treats an old proforma with a tax-series number as holding that tax number', async () => {
    const earlier = new Date('2026-10-01T00:00:00.000Z');
    const source = createMemoryStore();
    await createInvoiceStorage(source, { now: () => earlier }).invoices.save(makeInvoice({ id: 'old', kind: 'proforma', number: '2026-27/0002' }));
    const file = (await createBackup(source, earlier)).json;

    const device = createMemoryStore();
    await createInvoiceStorage(device, { now: () => NOW }).invoices.save(makeInvoice({ id: 'b', number: '2026-27/0002' }));
    expect((await compareWithDevice(device, file)).reusableNumbers).toEqual([]);
  });

  it('reports nothing for a file that already holds everything and is newer', async () => {
    const device = createMemoryStore();
    await createInvoiceStorage(device, { now: () => new Date('2026-10-01T00:00:00.000Z') }).invoices.save(makeInvoice({ id: 'a' }));
    const snapshot = JSON.parse((await createBackup(device, NOW)).json);
    snapshot.exportedAt = '2026-10-20T00:00:00.000Z';
    expect(await compareWithDevice(device, JSON.stringify(snapshot))).toEqual({ missing: [], missingIssued: 0, reusableNumbers: [], missingContracts: [], missingFinalContracts: 0, fileIsOlder: false });
  });
});

describe('compareWithDevice and agreements', () => {
  const T1 = new Date('2026-10-10T00:00:00.000Z');
  const fileOf = async (build: (store: ReturnType<typeof createMemoryStore>) => Promise<void>, exportedAt?: string) => {
    const source = createMemoryStore();
    await build(source);
    const parsed = JSON.parse((await createBackup(source, NOW)).json) as { exportedAt: string };
    if (exportedAt) parsed.exportedAt = exportedAt;
    return JSON.stringify(parsed);
  };

  it('lists agreements on the device that the file does not have, final ones first', async () => {
    const device = createMemoryStore();
    const contracts = createContractStorage(device, { now: () => T1 });
    await contracts.save(makeContract('services', { id: 'a-draft', title: 'Draft for Acme' }));
    await contracts.save(makeContract('nda-mutual', { id: 'z-final', title: 'NDA with Zed' }));
    await contracts.finalise('z-final');
    await contracts.save(makeContract('nda-one-way', { id: 'kept', title: 'Kept' }));
    const file = await fileOf(async (source) => {
      await createContractStorage(source, { now: () => T1 }).save(makeContract('nda-one-way', { id: 'kept', title: 'Kept' }));
    }, '2026-10-20T00:00:00.000Z');

    const result = await compareWithDevice(device, file);
    expect(result.missingContracts).toEqual([
      { id: 'z-final', title: 'NDA with Zed', status: 'final' },
      { id: 'a-draft', title: 'Draft for Acme', status: 'draft' },
    ]);
    expect(result.missingFinalContracts).toBe(1);
    expect(result.fileIsOlder).toBe(false);
  });

  it('counts a change to an agreement as a newer change on the device', async () => {
    const device = createMemoryStore();
    await createContractStorage(device, { now: () => new Date('2026-10-12T00:00:00.000Z') }).save(makeContract('services', { id: 's1' }));
    const file = await fileOf(async (source) => {
      await createContractStorage(source, { now: () => T1 }).save(makeContract('services', { id: 's1' }));
    }, '2026-10-11T00:00:00.000Z');
    const result = await compareWithDevice(device, file);
    expect(result.missingContracts).toEqual([]);
    expect(result.fileIsOlder).toBe(true);
  });

  it('says nothing when the file holds every agreement and is newer', async () => {
    const device = createMemoryStore();
    await createContractStorage(device, { now: () => T1 }).save(makeContract('services', { id: 's1' }));
    const file = await fileOf(async () => {}, '2026-10-20T00:00:00.000Z');
    const withIt = JSON.parse(file) as { collections: { contracts: unknown[] } };
    withIt.collections.contracts = JSON.parse((await createBackup(device, NOW)).json).collections.contracts;
    expect(await compareWithDevice(device, JSON.stringify(withIt))).toMatchObject({ missingContracts: [], missingFinalContracts: 0, fileIsOlder: false });
  });
});

describe('agreements in backups', () => {
  it('backs up agreements with everything else and restores them on another device', async () => {
    const source = createMemoryStore();
    await createInvoiceStorage(source, { now: () => NOW }).invoices.save(makeInvoice({ id: 'inv' }));
    const contracts = createContractStorage(source, { now: () => NOW });
    await contracts.save(makeContract('services'));
    await contracts.save(makeContract('nda-mutual'));
    await contracts.finalise('contract-nda-mutual');
    const { json } = await createBackup(source, NOW);

    expect(inspectBackup(json)).toMatchObject({ invoices: 1, contracts: 2 });
    const target = createMemoryStore();
    await restoreBackup(target, json);
    const restored = createContractStorage(target);
    expect((await restored.list()).map((contract) => contract.id).sort()).toEqual(['contract-nda-mutual', 'contract-services']);
    const final = await restored.get('contract-nda-mutual');
    expect(final?.status).toBe('final');
    expect(final?.finalDocument?.heading).toBe('Mutual Non-Disclosure Agreement');
    expect(await restored.get('contract-services')).toEqual(await contracts.get('contract-services'));
  });

  it('restores a backup made before agreements existed, clearing any agreements on the device only after saying which would be lost', async () => {
    const source = createMemoryStore();
    await createInvoiceStorage(source, { now: () => NOW }).invoices.save(makeInvoice({ id: 'inv' }));
    const parsed = JSON.parse((await createBackup(source, NOW)).json) as { collections: Record<string, unknown> };
    delete parsed.collections['contracts'];
    const old = JSON.stringify(parsed);
    expect(inspectBackup(old).contracts).toBe(0);

    const target = createMemoryStore();
    await createContractStorage(target).save(makeContract('services'));
    expect(await compareWithDevice(target, old)).toMatchObject({
      missingContracts: [{ id: 'contract-services', title: 'Sample services', status: 'draft' }],
      missingFinalContracts: 0,
    });
    await restoreBackup(target, old);
    expect(await createContractStorage(target).list()).toEqual([]);
    expect((await createInvoiceStorage(target).invoices.list()).map((invoice) => invoice.id)).toEqual(['inv']);
  });

  it('refuses a backup with a damaged agreement, changing nothing', async () => {
    const source = createMemoryStore();
    await createContractStorage(source, { now: () => NOW }).save(makeContract('services'));
    const parsed = JSON.parse((await createBackup(source, NOW)).json) as { collections: { contracts: Record<string, unknown>[] } };
    delete parsed.collections.contracts[0]!['parties'];
    const damaged = JSON.stringify(parsed);

    const target = createMemoryStore();
    await createInvoiceStorage(target, { now: () => NOW }).invoices.save(makeInvoice({ id: 'keep' }));
    expect(() => inspectBackup(damaged)).toThrow(StorageError);
    await expect(restoreBackup(target, damaged)).rejects.toBeInstanceOf(StorageError);
    expect((await createInvoiceStorage(target).invoices.list()).map((invoice) => invoice.id)).toEqual(['keep']);
  });
});

describe('workspace backups', () => {
  const NOW = new Date('2026-10-17T10:00:00.000Z');
  const manager = () => createWorkspaceManager({ factory: null, storage: null, broadcast: false });

  async function sourceBackup(header?: { workspaceName?: string }) {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => NOW });
    await storage.profile.save(makeSeller({ name: 'Asha Rao Consulting' }));
    await storage.clients.save(makeClient({ id: 'c1' }));
    await storage.invoices.save(makeInvoice({ id: 'i1' }));
    return (await createBackup(store, NOW, header)).json;
  }

  it('writes the business name at the top of the file and keeps the format version', async () => {
    const parsed = JSON.parse(await sourceBackup({ workspaceName: 'Studio One' }));
    expect(parsed.version).toBe(1);
    expect(parsed.workspace).toEqual({ name: 'Studio One' });
    expect(inspectBackup(JSON.stringify(parsed)).workspaceName).toBe('Studio One');
  });

  it('files without the header (every older backup) still inspect and restore into the current business', async () => {
    const json = await sourceBackup();
    expect(JSON.parse(json).workspace).toBeUndefined();
    expect(inspectBackup(json).workspaceName).toBeUndefined();
    const target = createMemoryStore();
    await restoreBackup(target, json);
    expect(await target.list('invoices')).toHaveLength(1);
  });

  it('restores into a new business named after the file, leaving the current one untouched', async () => {
    const workspaces = manager();
    const [first] = await workspaces.list();
    const firstStore = await workspaces.openStore(first!.id);
    await firstStore.put('clients', { id: 'keep', name: 'Keep me', address: { line1: 'a', city: 'b', country: 'c' } } as never);

    const created = await restoreIntoNewWorkspace(workspaces, await sourceBackup({ workspaceName: 'Studio One' }));
    expect(created.name).toBe('Studio One');
    const restored = await workspaces.openStore(created.id);
    expect((await restored.list('invoices')).map((invoice) => invoice.id)).toEqual(['i1']);
    expect((await restored.list('clients')).map((client) => client.id)).toEqual(['c1']);
    expect((await firstStore.list('clients')).map((client) => client.id)).toEqual(['keep']);
    expect(await firstStore.list('invoices')).toEqual([]);
    expect((await createInvoiceStorage(restored).settings.get()).lastBackupAt).toBe(NOW.toISOString());
    expect((await workspaces.current()).id).toBe(first!.id);
  });

  it('names the new business after the profile for an older file, or by the name given', async () => {
    const workspaces = manager();
    expect((await restoreIntoNewWorkspace(workspaces, await sourceBackup())).name).toBe('Asha Rao Consulting');
    expect((await restoreIntoNewWorkspace(workspaces, await sourceBackup(), { name: 'Chosen' })).name).toBe('Chosen');
    const empty = JSON.stringify({ version: 1, exportedAt: NOW.toISOString(), collections: {} });
    expect((await restoreIntoNewWorkspace(workspaces, empty)).name).toBe('Restored business');
  });

  it('creates nothing when the file is not a usable backup', async () => {
    const workspaces = manager();
    await expect(restoreIntoNewWorkspace(workspaces, 'not json')).rejects.toBeInstanceOf(StorageError);
    await expect(restoreIntoNewWorkspace(workspaces, JSON.stringify({ version: 1, exportedAt: 'x', collections: { clients: [{ id: 'c', name: 1 }] } }))).rejects.toBeInstanceOf(StorageError);
    expect(await workspaces.list()).toHaveLength(1);
  });

  it('removes the new business again if the import fails part way', async () => {
    const workspaces = manager();
    await workspaces.list();
    const real = workspaces.openStore.bind(workspaces);
    workspaces.openStore = async (id) => ({ ...(await real(id)), importAll: () => Promise.reject(new StorageError('disk full')) });
    await expect(restoreIntoNewWorkspace(workspaces, await sourceBackup())).rejects.toThrow('disk full');
    expect(await workspaces.list()).toHaveLength(1);
  });
});
