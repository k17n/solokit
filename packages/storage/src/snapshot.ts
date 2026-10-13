import { COLLECTIONS, StorageError, type CollectionName, type Snapshot, type StoredRecord } from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function emptyCollections(): Record<CollectionName, StoredRecord[]> {
  return { profile: [], clients: [], invoices: [], themes: [], settings: [] };
}

/** Validates untrusted input (for example a backup file) and returns a clean Snapshot. */
export function parseSnapshot(input: unknown): Snapshot {
  if (!isObject(input) || input.version !== 1 || typeof input.exportedAt !== 'string' || !isObject(input.collections)) {
    throw new StorageError('This is not a SoloKit backup file');
  }
  const collections = emptyCollections();
  for (const name of COLLECTIONS) {
    const records = input.collections[name];
    if (records === undefined) continue;
    if (!Array.isArray(records)) {
      throw new StorageError(`Backup collection "${name}" must be a list`);
    }
    for (const record of records) {
      if (!isObject(record) || typeof record.id !== 'string' || record.id === '') {
        throw new StorageError(`Backup collection "${name}" has a record without an id`);
      }
      collections[name].push(record as unknown as StoredRecord);
    }
  }
  return { version: 1, exportedAt: input.exportedAt, collections };
}
