import { parseSnapshot, emptyCollections } from './snapshot';
import { COLLECTIONS, StorageError, type CollectionName, type DataStore, type Snapshot, type StoredRecord } from './types';

function assertRecord(record: StoredRecord): void {
  if (typeof record.id !== 'string' || record.id === '') {
    throw new StorageError('A record needs a non-empty id');
  }
}

/** In-memory adapter: used by tests and as the fallback when the browser blocks IndexedDB. */
export function createMemoryStore(): DataStore {
  const tables = new Map<CollectionName, Map<string, StoredRecord>>(COLLECTIONS.map((name) => [name, new Map()]));

  function table(collection: CollectionName): Map<string, StoredRecord> {
    const found = tables.get(collection);
    if (!found) throw new StorageError(`Unknown collection "${collection}"`);
    return found;
  }

  return {
    async get<T extends StoredRecord>(collection: CollectionName, id: string) {
      const record = table(collection).get(id);
      return record === undefined ? undefined : (structuredClone(record) as T);
    },

    async put<T extends StoredRecord>(collection: CollectionName, record: T) {
      assertRecord(record);
      table(collection).set(record.id, structuredClone(record));
    },

    async list<T extends StoredRecord>(collection: CollectionName) {
      return [...table(collection).values()].map((record) => structuredClone(record) as T);
    },

    async remove(collection, id) {
      table(collection).delete(id);
    },

    async exportAll(): Promise<Snapshot> {
      const collections = emptyCollections();
      for (const name of COLLECTIONS) {
        collections[name] = [...table(name).values()].map((record) => structuredClone(record));
      }
      return { version: 1, exportedAt: new Date().toISOString(), collections };
    },

    async importAll(input) {
      const snapshot = parseSnapshot(input);
      for (const name of COLLECTIONS) {
        const next = table(name);
        next.clear();
        for (const record of snapshot.collections[name]) next.set(record.id, structuredClone(record));
      }
    },
  };
}
