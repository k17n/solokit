export const COLLECTIONS = ['profile', 'clients', 'invoices', 'themes', 'settings', 'contracts'] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export interface StoredRecord {
  id: string;
}

export interface Snapshot {
  version: 1;
  exportedAt: string;
  /** Which Business (workspace) the backup came from. Optional: older files do not have it. */
  workspace?: { name: string };
  collections: Record<CollectionName, StoredRecord[]>;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * The database on this device is newer than the code running in this tab (SoloKit was updated in another tab, or this
 * page came from an old cache). Nothing more can be saved until the page is reloaded.
 */
export class StorageVersionError extends StorageError {
  constructor(message = 'The saved data was made by a newer version of SoloKit') {
    super(message);
    this.name = 'StorageVersionError';
  }
}

/** Another tab still holds an older version of the database open, so it cannot be upgraded yet. */
export class StorageBlockedError extends StorageError {
  constructor(message = 'IndexedDB is blocked by another tab') {
    super(message);
    this.name = 'StorageBlockedError';
  }
}

/** The Business this store belongs to was deleted (here or in another tab). Writing now would bring back an empty database, so every request fails instead. */
export class StorageDeletedError extends StorageError {
  constructor(message = 'This business was deleted in another tab') {
    super(message);
    this.name = 'StorageDeletedError';
  }
}

/** True when the error means "reload this page": the data was upgraded, or an upgrade is waiting on this tab. */
export function isOutdatedStoreError(error: unknown): boolean {
  return error instanceof StorageVersionError || error instanceof StorageBlockedError || (error instanceof Error && error.name === 'VersionError');
}

/** A store that can be told its data is gone. Afterwards every request rejects with a {@link StorageDeletedError}. */
export interface RemovableStore extends DataStore {
  markRemoved(): Promise<void>;
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
