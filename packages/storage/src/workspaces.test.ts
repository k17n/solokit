import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIndexedDbStore } from './idb-store';
import { StorageBlockedError } from './types';
import { createWorkspaceManager, CURRENT_WORKSPACE_KEY, WorkspaceError, type WorkspaceManagerOptions } from './workspaces';

afterEach(() => vi.restoreAllMocks());

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

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

describe('first use', () => {
  it('creates the default business lazily on a fresh install, pointing at the existing database name', async () => {
    const { manager, factory } = setup();
    expect(await databaseNames(factory)).toEqual([]);
    const all = await manager.list();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 'default', name: 'My business', dbName: 'solokit' });
    expect((await manager.current()).id).toBe('default');
  });

  it('adopts an existing install: named from the saved profile, data not copied or touched', async () => {
    const { manager, factory } = setup();
    const old = createIndexedDbStore({ name: 'solokit', factory });
    await old.put('profile', { id: 'me', name: '  Asha   Rao Consulting ' } as never);
    await old.put('invoices', { id: 'i1' } as never);
    await old.close();

    const [first] = await manager.list();
    expect(first).toMatchObject({ name: 'Asha Rao Consulting', dbName: 'solokit' });
    const store = await manager.openStore(first!.id);
    expect(await store.list('invoices')).toEqual([{ id: 'i1' }]);
    expect(await databaseNames(factory)).toEqual(['solokit', 'solokit-workspaces']);
  });

  it('is idempotent: a second manager and concurrent starts register the existing database once', async () => {
    const { make } = setup();
    const a = make();
    const b = make();
    const [la, lb] = await Promise.all([a.list(), b.list()]);
    expect(la).toHaveLength(1);
    expect(lb).toHaveLength(1);
    expect(await make().list()).toHaveLength(1);
    expect(la[0]!.id).toBe(lb[0]!.id);
  });

  it('keeps working, pointing at the existing data, when the registry cannot be written', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const factory = new IDBFactory();
    const real = factory.open.bind(factory);
    // The registry opens, but any write to it fails.
    factory.open = ((name: string, version?: number) => {
      const request = real(name, version);
      if (name !== 'solokit-workspaces') return request;
      request.addEventListener('success', () => {
        const db = request.result;
        const transaction = db.transaction.bind(db);
        db.transaction = ((stores: string | string[], mode?: IDBTransactionMode) => {
          if (mode === 'readwrite') throw new Error('quota exceeded');
          return transaction(stores, mode);
        }) as typeof db.transaction;
      });
      return request;
    }) as typeof factory.open;
    const manager = createWorkspaceManager({ factory, storage: null, broadcast: false });
    const all = await manager.list();
    expect(all).toHaveLength(1);
    expect(all[0]!.dbName).toBe('solokit');
    expect(manager.persistent).toBe(false);
    await (await manager.openStore(all[0]!.id)).put('settings', { id: 'x' } as never);
    expect(await createIndexedDbStore({ name: 'solokit', factory }).get('settings', 'x')).toEqual({ id: 'x' });
  });

  it('works entirely in memory when IndexedDB is unavailable', async () => {
    const manager = createWorkspaceManager({ factory: null, storage: null, broadcast: false });
    const first = (await manager.list())[0]!;
    expect(manager.persistent).toBe(false);
    const store = await manager.openStore(first.id);
    await store.put('clients', { id: 'c' } as never);
    expect(await (await manager.openStore(first.id)).list('clients')).toHaveLength(1);
    const second = await manager.create('Second');
    expect(await (await manager.openStore(second.id)).list('clients')).toEqual([]);
  });
});

describe('several businesses', () => {
  it('gives new businesses their own database and keeps their data apart', async () => {
    const { manager, factory } = setup();
    const first = (await manager.list())[0]!;
    const second = await manager.create('  Studio  Two ');
    expect(second).toMatchObject({ id: 'w1', name: 'Studio Two', dbName: 'solokit-ws-w1' });

    await (await manager.openStore(first.id)).put('clients', { id: 'c1', name: 'Only in first' } as never);
    await (await manager.openStore(second.id)).put('clients', { id: 'c2', name: 'Only in second' } as never);

    expect(await (await manager.openStore(first.id)).list('clients')).toEqual([{ id: 'c1', name: 'Only in first' }]);
    expect(await (await manager.openStore(second.id)).list('clients')).toEqual([{ id: 'c2', name: 'Only in second' }]);
    expect(await databaseNames(factory)).toEqual(['solokit', 'solokit-workspaces', 'solokit-ws-w1']);
  });

  it('returns the same store instance while the business is open', async () => {
    const { manager } = setup();
    const first = (await manager.list())[0]!;
    expect(await manager.openStore(first.id)).toBe(await manager.openStore(first.id));
  });

  it('remembers the current business in the registry and in local storage, and survives a restart', async () => {
    const { manager, make, storage } = setup();
    await manager.list();
    const second = await manager.create('Second');
    expect((await manager.current()).id).toBe('default');
    await manager.setCurrent(second.id);
    expect(storage.data.get(CURRENT_WORKSPACE_KEY)).toBe('w1');
    expect((await make().current()).id).toBe('w1');
  });

  it('falls back to the oldest business when the remembered id is gone', async () => {
    const { manager, storage } = setup();
    await manager.list();
    await manager.create('Second');
    storage.data.set(CURRENT_WORKSPACE_KEY, 'ghost');
    expect((await manager.current()).id).toBe('default');
  });

  it('does not break when local storage throws', async () => {
    const denied = () => {
      throw new Error('denied');
    };
    const { manager } = setup({ storage: { getItem: denied, setItem: denied, removeItem: denied } });
    const second = await manager.create('Second');
    await manager.setCurrent(second.id);
    expect((await manager.current()).id).toBe('w1');
  });

  it('rejects empty and over-long names', async () => {
    const { manager } = setup();
    await expect(manager.create('   ')).rejects.toMatchObject({ code: 'invalid-name' });
    await expect(manager.create('x'.repeat(81))).rejects.toBeInstanceOf(WorkspaceError);
    await expect(manager.rename('default', '')).rejects.toMatchObject({ code: 'invalid-name' });
  });

  it('renames a business and stamps the change time, leaving data alone', async () => {
    const { manager } = setup();
    const first = (await manager.list())[0]!;
    await (await manager.openStore(first.id)).put('clients', { id: 'c1' } as never);
    const renamed = await manager.rename(first.id, ' New name ');
    expect(renamed.name).toBe('New name');
    expect(renamed.updatedAt > first.updatedAt).toBe(true);
    expect(renamed.createdAt).toBe(first.createdAt);
    expect(await (await manager.openStore(first.id)).list('clients')).toHaveLength(1);
    await expect(manager.rename('ghost', 'x')).rejects.toMatchObject({ code: 'not-found' });
  });
});

describe('archive', () => {
  it('hides a business from the current choice without touching its data, and can bring it back', async () => {
    const { manager } = setup();
    const first = (await manager.list())[0]!;
    const second = await manager.create('Second');
    await (await manager.openStore(second.id)).put('clients', { id: 'c' } as never);
    await manager.setCurrent(second.id);

    const archived = await manager.archive(second.id);
    expect(archived.archivedAt).toBeDefined();
    expect((await manager.current()).id).toBe(first.id);
    await expect(manager.setCurrent(second.id)).rejects.toMatchObject({ code: 'archived' });
    expect(await (await manager.openStore(second.id)).list('clients')).toHaveLength(1);

    const back = await manager.unarchive(second.id);
    expect(back.archivedAt).toBeUndefined();
    await manager.setCurrent(second.id);
    expect((await manager.current()).id).toBe(second.id);
  });

  it('refuses to archive the last active business', async () => {
    const { manager } = setup();
    const first = (await manager.list())[0]!;
    await expect(manager.archive(first.id)).rejects.toMatchObject({ code: 'last-active' });
    const second = await manager.create('Second');
    await manager.archive(second.id);
    await expect(manager.archive(first.id)).rejects.toMatchObject({ code: 'last-active' });
  });
});

describe('delete', () => {
  it('deletes the database and the registry row, even when its store is open', async () => {
    const { manager, factory } = setup();
    const first = (await manager.list())[0]!;
    const second = await manager.create('Second');
    await (await manager.openStore(second.id)).put('clients', { id: 'c' } as never);

    await manager.remove(second.id);

    expect((await manager.list()).map((w) => w.id)).toEqual([first.id]);
    expect(await databaseNames(factory)).not.toContain(second.dbName);
    await expect(manager.openStore(second.id)).rejects.toMatchObject({ code: 'not-found' });
  });

  it('refuses to delete the last business and leaves its data', async () => {
    const { manager, factory } = setup();
    const first = (await manager.list())[0]!;
    await (await manager.openStore(first.id)).put('clients', { id: 'c' } as never);
    await expect(manager.remove(first.id)).rejects.toMatchObject({ code: 'last-active' });
    expect(await manager.list()).toHaveLength(1);
    expect(await databaseNames(factory)).toContain('solokit');
    const second = await manager.create('Second');
    await manager.archive(second.id);
    await expect(manager.remove(first.id)).rejects.toMatchObject({ code: 'last-active' });
  });

  it('can delete an archived business, and the first (legacy) business', async () => {
    const { manager, factory } = setup();
    const first = (await manager.list())[0]!;
    const second = await manager.create('Second');
    await manager.archive(second.id);
    await manager.remove(second.id);
    const third = await manager.create('Third');
    await manager.remove(first.id);
    expect((await manager.list()).map((w) => w.id)).toEqual([third.id]);
    expect(await databaseNames(factory)).not.toContain('solokit');
  });

  it('moves the current choice to another business when the current one is deleted', async () => {
    const { manager, storage } = setup();
    const first = (await manager.list())[0]!;
    const second = await manager.create('Second');
    await manager.setCurrent(second.id);
    await manager.remove(second.id);
    expect((await manager.current()).id).toBe(first.id);
    expect(storage.data.get(CURRENT_WORKSPACE_KEY)).toBe(first.id);
  });

  it('succeeds when another connection lets go after the blocked event (like another tab handling versionchange)', async () => {
    const { manager, factory } = setup();
    await manager.list();
    const second = await manager.create('Second');
    const other = await openForeign(factory, second.dbName);
    other.onversionchange = () => other.close();
    await manager.remove(second.id);
    expect(await databaseNames(factory)).not.toContain(second.dbName);
  });

  it('fails with a blocked error, and keeps the business listed, when another connection never lets go', async () => {
    const { manager, factory } = setup();
    await manager.list();
    const second = await manager.create('Second');
    await openForeign(factory, second.dbName);
    await expect(manager.remove(second.id)).rejects.toBeInstanceOf(StorageBlockedError);
    expect((await manager.list()).map((w) => w.id)).toContain(second.id);
  });
});

describe('cross-tab notices', () => {
  it('tells other managers (tabs) when the list changes', async () => {
    const factory = new IDBFactory();
    const options = { factory, storage: memoryStorage(), newId: () => 'w9' };
    const a = createWorkspaceManager(options);
    const b = createWorkspaceManager(options);
    const heard = vi.fn();
    const stop = b.subscribe(heard);
    await a.list();
    await a.create('Second');
    await vi.waitFor(() => expect(heard).toHaveBeenCalled());
    stop();
    await a.close();
    await b.close();
  });
});
