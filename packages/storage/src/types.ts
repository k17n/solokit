export const COLLECTIONS = ['profile', 'clients', 'invoices', 'themes', 'settings'] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export interface StoredRecord {
  id: string;
}

export interface Snapshot {
  version: 1;
  exportedAt: string;
  collections: Record<CollectionName, StoredRecord[]>;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/** Where SoloKit keeps the user's data. Today: this device. Later: an optional synced adapter. */
export interface DataStore {
  get<T extends StoredRecord>(collection: CollectionName, id: string): Promise<T | undefined>;
  put<T extends StoredRecord>(collection: CollectionName, record: T): Promise<void>;
  list<T extends StoredRecord>(collection: CollectionName): Promise<T[]>;
  remove(collection: CollectionName, id: string): Promise<void>;
  exportAll(): Promise<Snapshot>;
  /** Replaces everything with the snapshot's contents. Invalid input throws StorageError and changes nothing. */
  importAll(snapshot: unknown): Promise<void>;
}
