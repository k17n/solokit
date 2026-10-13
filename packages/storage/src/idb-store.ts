import { emptyCollections, parseSnapshot } from './snapshot';
import { COLLECTIONS, StorageError, type CollectionName, type DataStore, type Snapshot, type StoredRecord } from './types';

const DEFAULT_NAME = 'solokit';
const VERSION = 1;

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new StorageError(request.error?.message ?? 'IndexedDB request failed'));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new StorageError(tx.error?.message ?? 'IndexedDB transaction failed'));
    tx.onabort = () => reject(new StorageError(tx.error?.message ?? 'IndexedDB transaction aborted'));
  });
}

function openDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, VERSION);
    request.onupgradeneeded = () => {
      for (const collection of COLLECTIONS) {
        if (!request.result.objectStoreNames.contains(collection)) {
          request.result.createObjectStore(collection, { keyPath: 'id' });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new StorageError(request.error?.message ?? 'Could not open IndexedDB'));
    request.onblocked = () => reject(new StorageError('IndexedDB is blocked by another tab'));
  });
}

export interface IndexedDbStoreOptions {
  name?: string;
  factory?: IDBFactory;
}

/** Browser adapter: keeps everything on the user's device. The database opens on first use. */
export function createIndexedDbStore(options: IndexedDbStoreOptions = {}): DataStore {
  const factory = options.factory ?? globalThis.indexedDB;
  if (!factory) throw new StorageError('IndexedDB is not available in this browser');
  const name = options.name ?? DEFAULT_NAME;

  let opening: Promise<IDBDatabase> | undefined;
  const database = () => (opening ??= openDatabase(factory, name));

  return {
    async get<T extends StoredRecord>(collection: CollectionName, id: string) {
      const db = await database();
      const found = await toPromise(db.transaction(collection).objectStore(collection).get(id));
      return found as T | undefined;
    },

    async put<T extends StoredRecord>(collection: CollectionName, record: T) {
      if (typeof record.id !== 'string' || record.id === '') {
        throw new StorageError('A record needs a non-empty id');
      }
      const db = await database();
      const tx = db.transaction(collection, 'readwrite');
      tx.objectStore(collection).put(record);
      await transactionDone(tx);
    },

    async list<T extends StoredRecord>(collection: CollectionName) {
      const db = await database();
      return (await toPromise(db.transaction(collection).objectStore(collection).getAll())) as T[];
    },

    async remove(collection, id) {
      const db = await database();
      const tx = db.transaction(collection, 'readwrite');
      tx.objectStore(collection).delete(id);
      await transactionDone(tx);
    },

    async exportAll(): Promise<Snapshot> {
      const db = await database();
      const tx = db.transaction([...COLLECTIONS]);
      const collections = emptyCollections();
      await Promise.all(
        COLLECTIONS.map(async (collection) => {
          collections[collection] = (await toPromise(tx.objectStore(collection).getAll())) as StoredRecord[];
        }),
      );
      return { version: 1, exportedAt: new Date().toISOString(), collections };
    },

    async importAll(input) {
      const snapshot = parseSnapshot(input);
      const db = await database();
      const tx = db.transaction([...COLLECTIONS], 'readwrite');
      for (const collection of COLLECTIONS) {
        const objectStore = tx.objectStore(collection);
        objectStore.clear();
        for (const record of snapshot.collections[collection]) objectStore.put(record);
      }
      await transactionDone(tx);
    },
  };
}
