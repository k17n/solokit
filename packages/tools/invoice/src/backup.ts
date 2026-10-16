import { StorageError, parseSnapshot, type DataStore, type Snapshot } from '@solokit/storage';
import { createInvoiceStorage } from './repositories';
import type { InvoiceRecord } from './model';
import { FONT_OPTIONS, isPresetThemeId } from './themes';

export interface BackupFile {
  filename: string;
  json: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Exports everything on this device as one JSON file. Nothing on the device changes: the file carries the
 * backup time (so a restore on another device shows the right "last backed up" date), but this device only
 * counts it as backed up once {@link recordBackup} is called, after the file has really been handed over.
 *
 * The file is plain, unencrypted JSON. It holds the seller's bank details, UPI id, logo and every client, so
 * the screen that offers it should tell people to keep it private. The filename date is UTC.
 */
export async function createBackup(store: DataStore, now: Date = new Date()): Promise<BackupFile> {
  const [snapshot, settings] = await Promise.all([store.exportAll(), createInvoiceStorage(store).settings.get()]);
  const stamped = { ...settings, lastBackupAt: now.toISOString() };
  snapshot.collections.settings = [...snapshot.collections.settings.filter((record) => record.id !== stamped.id), stamped];
  snapshot.exportedAt = now.toISOString();
  const json = JSON.stringify(snapshot, null, 2);
  return { filename: `solokit-backup-${now.toISOString().slice(0, 10)}.json`, json };
}

/** Records that a backup file was successfully handed to the user. Call it only after the download has started. */
export async function recordBackup(store: DataStore, now: Date = new Date()): Promise<void> {
  await createInvoiceStorage(store, { now: () => now }).settings.update({ lastBackupAt: now.toISOString() });
}

/** Largest backup file the restore screen will read. */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export interface BackupSummary {
  exportedAt: string;
  invoices: number;
  clients: number;
  themes: number;
  hasProfile: boolean;
  profileName?: string;
}

function parseBackupText(text: string): unknown {
  if (text.length > MAX_BACKUP_BYTES) {
    throw new StorageError(`This file is too large to be a SoloKit backup (the limit is ${MAX_BACKUP_BYTES / (1024 * 1024)} MB)`);
  }
  let parsed: unknown;
  try {
    // A file saved by Windows Notepad can start with an invisible byte-order mark that JSON.parse rejects.
    parsed = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new StorageError('This file is not a SoloKit backup (it is not valid JSON)');
  }
  const version = isRecord(parsed) ? parsed['version'] : undefined;
  if (typeof version === 'number' && version > 1) {
    throw new StorageError('This backup was made by a newer version of SoloKit. Update the app, then try again.');
  }
  return parsed;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const HEX = /^#[0-9a-fA-F]{6}$/;

const LAYOUTS: readonly string[] = ['classic', 'modern', 'minimal', 'bold', 'consultant', 'formal'];

function isUsableTheme(theme: Record<string, unknown>): boolean {
  const colours = [theme['accent'], theme['text'], theme['background']];
  return (
    typeof theme['name'] === 'string' &&
    typeof theme['layout'] === 'string' &&
    LAYOUTS.includes(theme['layout']) &&
    colours.every((colour) => typeof colour === 'string' && HEX.test(colour)) &&
    FONT_OPTIONS.some((font) => font.id === theme['fontId'])
  );
}

const isAddress = (value: unknown): boolean => isRecord(value) && typeof value['line1'] === 'string' && typeof value['city'] === 'string';

function checkRecords(snapshot: Snapshot): void {
  for (const record of snapshot.collections.profile) {
    const profile = record as unknown as Record<string, unknown>;
    if (typeof profile['name'] !== 'string' || !isAddress(profile['address'])) {
      throw new StorageError('The backup has a business profile that is incomplete, so it was not restored');
    }
  }
  for (const record of snapshot.collections.settings) {
    const settings = record as unknown as Record<string, unknown>;
    if (
      typeof settings['defaultThemeId'] !== 'string' ||
      typeof settings['onboarded'] !== 'boolean' ||
      (settings['lastBackupAt'] !== undefined && typeof settings['lastBackupAt'] !== 'string')
    ) {
      throw new StorageError('The backup has settings that are incomplete, so it was not restored');
    }
  }
  for (const record of snapshot.collections.invoices) {
    const invoice = record as unknown as Record<string, unknown>;
    const client = invoice['client'];
    const seller = invoice['seller'];
    if (
      typeof invoice['number'] !== 'string' ||
      typeof invoice['issueDate'] !== 'string' ||
      !isRecord(client) ||
      !isRecord(seller) ||
      !isAddress(client['address']) ||
      !isAddress(seller['address']) ||
      !Array.isArray(invoice['lines']) ||
      typeof invoice['status'] !== 'string'
    ) {
      throw new StorageError('The backup has an invoice that is incomplete, so it was not restored');
    }
    const snapshotTheme = invoice['themeSnapshot'];
    if (snapshotTheme !== undefined && (!isRecord(snapshotTheme) || !isUsableTheme(snapshotTheme))) {
      throw new StorageError('The backup has an invoice with a damaged theme, so it was not restored');
    }
  }
  for (const record of snapshot.collections.clients) {
    const client = record as unknown as Record<string, unknown>;
    if (typeof client['name'] !== 'string' || !isRecord(client['address'])) throw new StorageError('The backup has a client that is incomplete, so it was not restored');
  }
  for (const record of snapshot.collections.themes) {
    const theme = record as unknown as Record<string, unknown>;
    if (!isUsableTheme(theme) || isPresetThemeId(record.id)) {
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

export interface DeviceComparison {
  /** Invoices on this device that are not in the file (by id): issued and cancelled ones first, then drafts. */
  missing: { id: string; number: string; status: string }[];
  /** How many of those are issued or cancelled (they own an invoice number). */
  missingIssued: number;
  /** Numbers of missing issued or cancelled invoices that appear nowhere in the file, so they could be handed out again. */
  reusableNumbers: string[];
  /** The file was made before the newest change on this device. */
  fileIsOlder: boolean;
}

/** Compares a backup file with what is on this device, so the screen can warn about what a restore would lose. */
export async function compareWithDevice(store: DataStore, text: string): Promise<DeviceComparison> {
  const snapshot = parseSnapshot(parseBackupText(text));
  const device = await store.list<InvoiceRecord>('invoices');
  const key = (number: string) => number.trim().toUpperCase();
  const inFileIds = new Set(snapshot.collections.invoices.map((record) => record.id));
  const inFileNumbers = new Set(snapshot.collections.invoices.map((record) => key(String((record as unknown as { number?: unknown }).number ?? ''))));
  const missing = device
    .filter((invoice) => !inFileIds.has(invoice.id))
    .map((invoice) => ({ id: invoice.id, number: invoice.number, status: invoice.status }))
    .sort((a, b) => Number(a.status === 'draft') - Number(b.status === 'draft') || a.number.localeCompare(b.number, undefined, { numeric: true }));
  const owning = missing.filter((invoice) => invoice.status !== 'draft');
  const exported = Date.parse(snapshot.exportedAt);
  const newest = device.reduce((latest, invoice) => Math.max(latest, Date.parse(invoice.updatedAt) || 0), 0);
  return {
    missing,
    missingIssued: owning.length,
    reusableNumbers: owning.filter((invoice) => !inFileNumbers.has(key(invoice.number))).map((invoice) => invoice.number),
    fileIsOlder: !Number.isNaN(exported) && newest > exported,
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
