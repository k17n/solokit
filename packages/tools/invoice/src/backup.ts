import { StorageError, type DataStore } from '@solokit/storage';
import { createInvoiceStorage } from './repositories';

export interface BackupFile {
  filename: string;
  json: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Exports everything on this device as one JSON file and remembers when that happened. */
export async function createBackup(store: DataStore, now: Date = new Date()): Promise<BackupFile> {
  const snapshot = await store.exportAll();
  const json = JSON.stringify(snapshot, null, 2);
  await createInvoiceStorage(store, { now: () => now }).settings.update({ lastBackupAt: now.toISOString() });
  return { filename: `solokit-backup-${now.toISOString().slice(0, 10)}.json`, json };
}

/** Replaces everything on this device with the backup. Invalid files change nothing. */
export async function restoreBackup(store: DataStore, text: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new StorageError('This file is not a SoloKit backup (it is not valid JSON)');
  }
  await store.importAll(parsed);
}

/** True when there is data worth protecting and no recent backup. */
export function isBackupDue(lastBackupAt: string | undefined, now: Date, hasData: boolean, thresholdDays = 30): boolean {
  if (!hasData) return false;
  if (lastBackupAt === undefined) return true;
  const last = Date.parse(lastBackupAt);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > thresholdDays * DAY_MS;
}
