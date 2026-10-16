import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { StorageBlockedError, StorageDeletedError, StorageError } from './types';
import { createWorkspaceManager, CURRENT_WORKSPACE_KEY, type WorkspaceManagerOptions } from './workspaces';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

/** Several managers over one fake IndexedDB: each one is a tab, with its own tab storage. */
function setup(overrides: WorkspaceManagerOptions = {}) {
  const factory = new IDBFactory();
  let ticks = 0;
  let ids = 0;
  const storage = memoryStorage();
  const make = (extra: WorkspaceManagerOptions = {}) =>
    createWorkspaceManager({
      factory,
      storage,
      tabStorage: memoryStorage(),
      broadcast: false,
      now: () => new Date(Date.UTC(2026, 9, 17, 9, 0, ++ticks)),
      newId: () => `w${++ids}`,
      deleteTimeoutMs: 200,
      ...overrides,
      ...extra,
    });
  return { factory, storage, make, manager: make() };
}

const databaseNames = async (factory: IDBFactory) => (await factory.databases()).map((db) => db.name).sort();

function openForeign(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve) => {
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('x');
    request.onsuccess = () => resolve(request.result);
  });
}

/** Writes to the registry database directly, the way a stale or misbehaving tab could. */
async function rawRegistry(factory: IDBFactory, change: (rows: Record<string, unknown>[]) => { put?: Record<string, unknown>[]; remove?: string[] }): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open('solokit-workspaces', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const tx = db.transaction('workspaces', 'readwrite');
  const store = tx.objectStore('workspaces');
  const rows = await new Promise<Record<string, unknown>[]>((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });
  const outcome = change(rows);
  for (const row of outcome.put ?? []) store.put(row);
  for (const id of outcome.remove ?? []) store.delete(id);
  await new Promise<void>((resolve) => {
    tx.oncomplete = () => resolve();
  });
  db.close();
}

describe('each tab has its own current business', () => {
  it('does not move another tab when one tab switches, but a new tab starts on the last choice', async () => {
    const { make } = setup();
    const tabA = make();
    const tabB = make();
    await tabA.list();
    const second = await tabA.create('Second');
    expect((await tabA.current()).id).toBe('default');
    expect((await tabB.current()).id).toBe('default');
    await tabA.setCurrent(second.id);
    expect((await tabA.current()).id).toBe(second.id);
    expect((await tabB.current()).id).toBe('default');
    expect((await make().current()).id).toBe(second.id);
  });

  it('moves a tab only when its business was archived or deleted elsewhere', async () => {
    const { make } = setup();
    const tabA = make();
    const tabB = make();
    await tabA.list();
    const second = await tabA.create('Second');
    const third = await tabA.create('Third');
    await tabB.setCurrent(second.id);
    await tabA.setCurrent(third.id);
    expect((await tabB.current()).id).toBe(second.id);

    await tabA.archive(second.id);
    expect((await tabB.current()).id).toBe(third.id);

    await tabA.unarchive(second.id);
    await tabB.setCurrent(second.id);
    await tabA.remove(second.id);
    expect((await tabB.current()).id).toBe('default');
  });

  it('keeps the choice in the tab storage, so a reload of the tab stays on the same business', async () => {
    const { make, storage } = setup();
    const tabStorage = memoryStorage();
    const first = make({ tabStorage });
    await first.list();
    const second = await first.create('Second');
    await first.setCurrent(second.id);
    // Someone else changes the default for new tabs.
    storage.data.set(CURRENT_WORKSPACE_KEY, 'default');
    expect((await make({ tabStorage }).current()).id).toBe(second.id);
  });
});

describe('the last active business cannot be lost to two tabs at once', () => {
  it('lets only one of two simultaneous archives of the last two businesses through', async () => {
    const { make } = setup();
    const tabA = make();
    const tabB = make();
    await tabA.list();
    const second = await tabA.create('Second');
    const results = await Promise.allSettled([tabA.archive('default'), tabB.archive(second.id)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const refused = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(refused?.reason).toMatchObject({ code: 'last-active' });
    expect((await tabA.list()).filter((workspace) => workspace.archivedAt === undefined)).toHaveLength(1);
  });

  it('lets only one of two simultaneous deletes of the last two businesses through, and keeps the survivor', async () => {
    const { make, factory } = setup();
    const tabA = make();
    const tabB = make();
    await tabA.list();
    const second = await tabA.create('Second');
    const results = await Promise.allSettled([tabA.remove('default'), tabB.remove(second.id)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result): result is PromiseRejectedResult => result.status === 'rejected')?.reason).toMatchObject({ code: 'last-active' });
    const left = await tabA.list();
    expect(left).toHaveLength(1);
    await (await tabA.openStore(left[0]!.id)).list('clients');
    expect(await databaseNames(factory)).toContain(left[0]!.dbName);
  });

  it('puts the list entry back when the database could not be deleted', async () => {
    const { manager, factory } = setup();
    await manager.list();
    const second = await manager.create('Second');
    await openForeign(factory, second.dbName);
    await expect(manager.remove(second.id)).rejects.toBeInstanceOf(StorageBlockedError);
    expect((await manager.list()).map((workspace) => workspace.id)).toEqual(['default', second.id]);
  });
});

describe('current() heals a registry with no active business', () => {
  it('brings back the most recently changed business when every one is archived', async () => {
    const { manager, factory } = setup();
    await manager.list();
    const second = await manager.create('Second');
    await manager.create('Third');
    await manager.rename(second.id, 'Second again');
    await rawRegistry(factory, (rows) => ({ put: rows.map((row) => ({ ...row, archivedAt: '2026-01-01T00:00:00.000Z' })) }));
    const healed = await manager.current();
    expect(healed.id).toBe(second.id);
    expect(healed.archivedAt).toBeUndefined();
    expect((await manager.list()).filter((workspace) => workspace.archivedAt === undefined).map((workspace) => workspace.id)).toEqual([second.id]);
  });

  it('makes the default business again when the list was emptied', async () => {
    const { manager, factory } = setup();
    await manager.list();
    await rawRegistry(factory, (rows) => ({ remove: rows.map((row) => String(row['id'])) }));
    const healed = await manager.current();
    expect(healed).toMatchObject({ id: 'default', name: 'My business', dbName: 'solokit' });
    expect(await manager.list()).toHaveLength(1);
  });
});

describe('a deleted business cannot be written to from another tab', () => {
  it('makes the other tab cached store reject, tells it, and does not bring the database back', async () => {
    const { make, factory } = setup();
    const tabA = make();
    const tabB = make();
    await tabA.list();
    const second = await tabA.create('Second');
    const seenByB = await tabB.openStore(second.id);
    await seenByB.put('clients', { id: 'c1', name: 'Kept' } as never);
    const heard = vi.fn();
    tabB.subscribe(heard);

    await tabA.remove(second.id);

    await expect(seenByB.put('clients', { id: 'c2', name: 'Late' } as never)).rejects.toMatchObject({ name: 'StorageDeletedError', message: 'This business was deleted in another tab' });
    await expect(seenByB.list('clients')).rejects.toBeInstanceOf(StorageError);
    expect(heard).toHaveBeenCalled();
    expect(await databaseNames(factory)).not.toContain(second.dbName);
    await expect(tabB.openStore(second.id)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('marks the deleting tab own cached store closed too', async () => {
    const { manager, factory } = setup();
    await manager.list();
    const second = await manager.create('Second');
    const store = await manager.openStore(second.id);
    await store.put('clients', { id: 'c1', name: 'Gone' } as never);
    await manager.remove(second.id);
    await expect(store.put('clients', { id: 'c2', name: 'Late' } as never)).rejects.toBeInstanceOf(StorageDeletedError);
    expect(await databaseNames(factory)).not.toContain(second.dbName);
  });

  it('marks memory-backed stores closed as well', async () => {
    let ids = 0;
    const manager = createWorkspaceManager({ factory: null, storage: null, broadcast: false, newId: () => `m${++ids}` });
    await manager.list();
    const second = await manager.create('Second');
    const store = await manager.openStore(second.id);
    await manager.remove(second.id);
    await expect(store.list('clients')).rejects.toBeInstanceOf(StorageDeletedError);
  });
});

describe('workspace names and persistence flags', () => {
  it('follows the profile name only while nameInSync is set, and a rename by hand ends it', async () => {
    const { manager } = setup();
    await manager.list();
    const plain = await manager.create('Plain');
    const synced = await manager.create('Synced', { nameInSync: true });
    expect(plain.nameInSync).toBeUndefined();
    expect(synced.nameInSync).toBe(true);
    expect((await manager.rename(synced.id, 'Follows', { keepInSync: true })).nameInSync).toBe(true);
    expect((await manager.rename(synced.id, 'By hand')).nameInSync).toBe(false);
    expect((await manager.rename(synced.id, 'Follows again', { keepInSync: true })).nameInSync).toBe(false);
    expect((await manager.rename(plain.id, 'Plain too', { keepInSync: true })).nameInSync).toBeUndefined();
    expect((await manager.list()).find((workspace) => workspace.id === 'default')?.nameInSync).toBe(true);
  });

  it('reports memory-only stores as not persistent', async () => {
    const memory = createWorkspaceManager({ factory: null, storage: null, broadcast: false });
    await memory.list();
    expect(memory.storesPersistent).toBe(false);
    expect(memory.persistent).toBe(false);
    expect(setup().manager.storesPersistent).toBe(true);
  });

  it('releases a cached store without breaking it', async () => {
    const { manager } = setup();
    await manager.list();
    const second = await manager.create('Second');
    const first = await manager.openStore(second.id);
    await manager.release(second.id);
    expect(await manager.openStore(second.id)).not.toBe(first);
    await first.put('clients', { id: 'c1', name: 'Still works' } as never);
  });
});
