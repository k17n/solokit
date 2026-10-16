import { emptyCollections, parseSnapshot } from './snapshot';
import { COLLECTIONS, StorageBlockedError, StorageDeletedError, StorageError, StorageVersionError, type CollectionName, type DataStore, type RemovableStore, type Snapshot, type StoredRecord } from './types';

const DEFAULT_NAME = 'solokit';
// Version 2 added the contracts collection; the upgrade creates any object store that is missing.
const VERSION = 2;

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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function openDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    try {
      const request = factory.open(name, VERSION);
      request.onupgradeneeded = () => {
        for (const collection of COLLECTIONS) {
          if (!request.result.objectStoreNames.contains(collection)) {
            request.result.createObjectStore(collection, { keyPath: 'id' });
          }
        }
      };
      request.onsuccess = () => {
        if (settled) {
          request.result.close();
          return;
        }
        settled = true;
        resolve(request.result);
      };
      request.onerror = () => {
        if (settled) return;
        settled = true;
        // The database was upgraded by a newer SoloKit (another tab, or this page is an old copy): it cannot be opened at our version.
        if (request.error?.name === 'VersionError') reject(new StorageVersionError(request.error.message));
        else reject(new StorageError(request.error?.message ?? 'Could not open IndexedDB'));
      };
      request.onblocked = () => {
        if (settled) return;
        settled = true;
        reject(new StorageBlockedError());
      };
    } catch (error) {
      settled = true;
      reject(new StorageError(`Could not open IndexedDB: ${errorMessage(error)}`));
    }
  });
}

export interface IndexedDbStoreOptions {
  name?: string;
  factory?: IDBFactory;
  /** Called when the database is deleted by someone else (another tab): the store has then marked itself removed. */
  onRemoved?: () => void;
}

export interface IndexedDbStore extends RemovableStore {
  /**
   * Closes the connection so the database can be deleted or upgraded by someone else. The store stays usable: the next
   * request opens it again (so after the database is deleted, the next request would create an empty one).
   */
  close(): Promise<void>;
}

/** Browser adapter: keeps everything on the user's device. The database opens on first use. */
export function createIndexedDbStore(options: IndexedDbStoreOptions = {}): IndexedDbStore {
  const factory = options.factory ?? globalThis.indexedDB;
  if (!factory) throw new StorageError('IndexedDB is not available in this browser');
  const name = options.name ?? DEFAULT_NAME;

  let opening: Promise<IDBDatabase> | undefined;
  let removed = false;
  const database = (): Promise<IDBDatabase> => {
    // After a delete, opening again would quietly create a new, empty database under the deleted Business's name.
    if (removed) return Promise.reject(new StorageDeletedError());
    if (!opening) {
      const attempt: Promise<IDBDatabase> = openDatabase(factory, name).then(
        (db) => {
          db.onversionchange = (event) => {
            db.close();
            if (opening === attempt) opening = undefined;
            // newVersion is null when the database is being deleted rather than upgraded.
            if (event.newVersion === null && !removed) {
              removed = true;
              options.onRemoved?.();
            }
          };
          db.onclose = () => {
            if (opening === attempt) opening = undefined;
          };
          return db;
        },
        (error) => {
          if (opening === attempt) opening = undefined;
          throw error;
        },
      );
      opening = attempt;
    }
    return opening;
  };

  return {
    async markRemoved() {
      removed = true;
      const pending = opening;
      opening = undefined;
      try {
        (await pending)?.close();
      } catch {
        // It never opened, so there is nothing to close.
      }
    },

    async close() {
      const pending = opening;
      opening = undefined;
      if (!pending) return;
      try {
        (await pending).close();
      } catch {
        // It never opened, so there is nothing to close.
      }
    },

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
      const done = transactionDone(tx);
      try {
        tx.objectStore(collection).put(record);
      } catch (error) {
        tx.abort();
        await done.catch(() => {});
        throw new StorageError(`Could not store this record: ${errorMessage(error)}`);
      }
      await done;
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
      const done = transactionDone(tx);
      try {
        for (const collection of COLLECTIONS) {
          const objectStore = tx.objectStore(collection);
          objectStore.clear();
          for (const record of snapshot.collections[collection]) objectStore.put(record);
        }
      } catch (error) {
        tx.abort();
        await done.catch(() => {});
        throw new StorageError(`Could not import this backup: ${errorMessage(error)}`);
      }
      await done;
    },
  };
}
