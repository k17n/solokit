import { StorageError, type DataStore } from '@solokit/storage';
import { createInvoiceStorage } from './repositories';

export interface BackupFile {
  filename: string;
  json: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Exports everything on this device as one JSON file.
 *
 * The backup time is recorded BEFORE the export, so the file carries its own time and a restore on another
 * device shows the right "last backed up" date. Call this only at the moment the file is actually handed to
 * the user (when the download starts), because the time is saved as soon as this runs.
 *
 * The file is plain, unencrypted JSON. It holds the seller's bank details, UPI id, logo and every client, so
 * the screen that offers it should tell people to keep it private. The filename date is UTC.
 */
export async function createBackup(store: DataStore, now: Date = new Date()): Promise<BackupFile> {
  await createInvoiceStorage(store, { now: () => now }).settings.update({ lastBackupAt: now.toISOString() });
  const snapshot = await store.exportAll();
  const json = JSON.stringify(snapshot, null, 2);
  return { filename: `solokit-backup-${now.toISOString().slice(0, 10)}.json`, json };
}

/**
 * Replaces everything on this device with the backup. Invalid files change nothing. A file from before
 * backups recorded their own time still counts as a backup made when it was exported.
 */
export async function restoreBackup(store: DataStore, text: string): Promise<void> {
  let parsed: unknown;
  try {
    // A file saved by Windows Notepad can start with an invisible byte-order mark that JSON.parse rejects.
    parsed = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new StorageError('This file is not a SoloKit backup (it is not valid JSON)');
  }
  await store.importAll(parsed);

  const exportedAt = (parsed as { exportedAt?: unknown }).exportedAt;
  if (typeof exportedAt === 'string') {
    const settings = createInvoiceStorage(store);
    if (!(await settings.settings.get()).lastBackupAt) {
      await settings.settings.update({ lastBackupAt: exportedAt });
    }
  }
}

/** True when there is data worth protecting and no recent, believable backup. */
export function isBackupDue(lastBackupAt: string | undefined, now: Date, hasData: boolean, thresholdDays = 30): boolean {
  if (!hasData) return false;
  if (lastBackupAt === undefined) return true;
  const last = Date.parse(lastBackupAt);
  if (Number.isNaN(last)) return true;
  // A backup time more than a day in the future means the clock was wrong; do not trust it.
  if (last - now.getTime() > DAY_MS) return true;
  return now.getTime() - last > thresholdDays * DAY_MS;
}
