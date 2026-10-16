import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { describeStoreContract } from './contract';
import { createIndexedDbStore } from './idb-store';
import { createMemoryStore } from './memory-store';
import { StorageBlockedError, StorageError, StorageVersionError, isOutdatedStoreError } from './types';

describeStoreContract('memory store', () => createMemoryStore());

let counter = 0;
const freshName = () => `solokit-test-${++counter}`;
describeStoreContract('IndexedDB store', () => createIndexedDbStore({ name: freshName() }));

describe('IndexedDB store', () => {
  it('persists across store instances that share a database name', async () => {
    const name = freshName();
    await createIndexedDbStore({ name }).put('settings', { id: 'theme', value: 'dark' } as never);
    const reopened = await createIndexedDbStore({ name }).get<{ id: string; value: string }>('settings', 'theme');
    expect(reopened).toEqual({ id: 'theme', value: 'dark' });
  });

  it('adds the contracts collection to a database created before it existed', async () => {
    const name = freshName();
    await new Promise<void>((resolve, reject) => {
      const old = indexedDB.open(name, 1);
      old.onupgradeneeded = () => {
        for (const collection of ['profile', 'clients', 'invoices', 'themes', 'settings']) old.result.createObjectStore(collection, { keyPath: 'id' });
        old.transaction!.objectStore('clients').put({ id: 'c1', name: 'Kept' });
      };
      old.onsuccess = () => {
        old.result.close();
        resolve();
      };
      old.onerror = () => reject(old.error);
    });
    const store = createIndexedDbStore({ name });
    expect(await store.get('clients', 'c1')).toEqual({ id: 'c1', name: 'Kept' });
    await store.put('contracts', { id: 'k1', title: 'NDA' } as never);
    expect(await store.list('contracts')).toEqual([{ id: 'k1', title: 'NDA' }]);
    expect((await store.exportAll()).collections.contracts).toHaveLength(1);
  });

  it('throws a StorageError when IndexedDB is unavailable', () => {
    vi.stubGlobal('indexedDB', undefined);
    try {
      expect(() => createIndexedDbStore()).toThrow(StorageError);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports a database that is newer than this code as a StorageVersionError, so the app can ask for a reload', async () => {
    const name = freshName();
    await new Promise<void>((resolve, reject) => {
      const newer = indexedDB.open(name, 9);
      newer.onsuccess = () => {
        newer.result.close();
        resolve();
      };
      newer.onerror = () => reject(newer.error);
    });
    const store = createIndexedDbStore({ name });
    const failure = await store.list('clients').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(StorageVersionError);
    expect(failure).toBeInstanceOf(StorageError);
    expect(isOutdatedStoreError(failure)).toBe(true);
    await expect(store.put('clients', { id: 'x' } as never)).rejects.toBeInstanceOf(StorageVersionError);
  });

  it('reports an upgrade that another tab is holding up as a StorageBlockedError', async () => {
    const name = freshName();
    const holder = await new Promise<IDBDatabase>((resolve, reject) => {
      const old = indexedDB.open(name, 1);
      old.onupgradeneeded = () => old.result.createObjectStore('clients', { keyPath: 'id' });
      old.onsuccess = () => resolve(old.result); // keeps the connection open and ignores versionchange, like a tab running old code
      old.onerror = () => reject(old.error);
    });
    try {
      const failure = await createIndexedDbStore({ name }).list('clients').catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(StorageBlockedError);
      expect(isOutdatedStoreError(failure)).toBe(true);
    } finally {
      holder.close();
    }
  });

  it('does not treat ordinary storage errors as "reload the page"', () => {
    expect(isOutdatedStoreError(new StorageError('quota'))).toBe(false);
    expect(isOutdatedStoreError(new Error('x'))).toBe(false);
    expect(isOutdatedStoreError(undefined)).toBe(false);
  });

  it('recovers after a failed open instead of caching the failure', async () => {
    let calls = 0;
    const factory = {
      open(dbName: string, version?: number) {
        if (++calls === 1) throw new Error('boom');
        return indexedDB.open(dbName, version);
      },
    } as unknown as IDBFactory;
    const store = createIndexedDbStore({ name: freshName(), factory });
    await expect(store.list('clients')).rejects.toBeInstanceOf(StorageError);
    await expect(store.list('clients')).resolves.toEqual([]);
  });
});
