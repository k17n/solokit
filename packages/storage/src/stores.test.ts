import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { describeStoreContract } from './contract';
import { createIndexedDbStore } from './idb-store';
import { createMemoryStore } from './memory-store';
import { StorageError } from './types';

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
