import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { createIndexedDbStore } from './idb-store';
import { StorageDeletedError } from './types';

describe('IndexedDB store when its database is deleted', () => {
  it('rejects later requests instead of recreating an empty database, and says so once', async () => {
    const factory = new IDBFactory();
    const onRemoved = vi.fn();
    const mine = createIndexedDbStore({ name: 'biz', factory, onRemoved });
    const theirs = createIndexedDbStore({ name: 'biz', factory });
    await mine.put('clients', { id: 'c1' });
    await theirs.put('clients', { id: 'c2' });

    // The other store deletes the database (it let go of its own connection first, as the workspace manager does).
    await theirs.close();
    await new Promise<void>((resolve, reject) => {
      const request = factory.deleteDatabase('biz');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    expect(onRemoved).toHaveBeenCalledTimes(1);
    await expect(mine.put('clients', { id: 'c3' })).rejects.toBeInstanceOf(StorageDeletedError);
    await expect(mine.get('clients', 'c1')).rejects.toMatchObject({ message: 'This business was deleted in another tab' });
    expect((await factory.databases()).map((db) => db.name)).not.toContain('biz');
  });

  it('is not marked removed by an upgrade, only by a delete', async () => {
    const factory = new IDBFactory();
    const onRemoved = vi.fn();
    const store = createIndexedDbStore({ name: 'biz', factory, onRemoved });
    await store.put('clients', { id: 'c1' });
    await new Promise<void>((resolve) => {
      const request = factory.open('biz', 3);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
    });
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it('markRemoved closes the connection and fails every later request', async () => {
    const factory = new IDBFactory();
    const store = createIndexedDbStore({ name: 'biz', factory });
    await store.put('clients', { id: 'c1' });
    await store.markRemoved();
    await expect(store.list('clients')).rejects.toBeInstanceOf(StorageDeletedError);
  });
});
