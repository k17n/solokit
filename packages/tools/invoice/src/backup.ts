import { StorageError, parseSnapshot, type DataStore, type Snapshot } from '@solokit/storage';
import { createInvoiceStorage } from './repositories';
import { FONT_OPTIONS } from './themes';

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

export interface BackupSummary {
  exportedAt: string;
  invoices: number;
  clients: number;
  themes: number;
  hasProfile: boolean;
  profileName?: string;
}

function parseBackupText(text: string): unknown {
  try {
    // A file saved by Windows Notepad can start with an invisible byte-order mark that JSON.parse rejects.
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new StorageError('This file is not a SoloKit backup (it is not valid JSON)');
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const HEX = /^#[0-9a-fA-F]{6}$/;

function checkRecords(snapshot: Snapshot): void {
  for (const record of snapshot.collections.invoices) {
    const invoice = record as unknown as Record<string, unknown>;
    if (
      typeof invoice['number'] !== 'string' ||
      typeof invoice['issueDate'] !== 'string' ||
      !isRecord(invoice['client']) ||
      !isRecord(invoice['seller']) ||
      !Array.isArray(invoice['lines']) ||
      typeof invoice['status'] !== 'string'
    ) {
      throw new StorageError('The backup has an invoice that is incomplete, so it was not restored');
    }
  }
  for (const record of snapshot.collections.clients) {
    const client = record as unknown as Record<string, unknown>;
    if (typeof client['name'] !== 'string' || !isRecord(client['address'])) throw new StorageError('The backup has a client that is incomplete, so it was not restored');
  }
  for (const record of snapshot.collections.themes) {
    const theme = record as unknown as Record<string, unknown>;
    const colours = [theme['accent'], theme['text'], theme['background']];
    if (
      typeof theme['name'] !== 'string' ||
      colours.some((colour) => typeof colour !== 'string' || !HEX.test(colour)) ||
      !FONT_OPTIONS.some((font) => font.id === theme['fontId'])
    ) {
      throw new StorageError('The backup has a theme that is incomplete, so it was not restored');
    }
  }
}

/** Checks a backup file and says what it holds, without changing anything. Throws StorageError for anything that is not a usable backup. */
export function inspectBackup(text: string): BackupSummary {
  const snapshot = parseSnapshot(parseBackupText(text));
  checkRecords(snapshot);
  const profile = snapshot.collections.profile[0] as unknown as { name?: unknown } | undefined;
  return {
    exportedAt: snapshot.exportedAt,
    invoices: snapshot.collections.invoices.length,
    clients: snapshot.collections.clients.length,
    themes: snapshot.collections.themes.length,
    hasProfile: profile !== undefined,
    ...(typeof profile?.name === 'string' ? { profileName: profile.name } : {}),
  };
}

/**
 * Replaces everything on this device with the backup. Invalid files change nothing. A file from before
 * backups recorded their own time still counts as a backup made when it was exported.
 */
export async function restoreBackup(store: DataStore, text: string): Promise<void> {
  const parsed = parseBackupText(text);
  checkRecords(parseSnapshot(parsed));
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
