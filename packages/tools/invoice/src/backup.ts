import { checkContractRecords, type Contract } from '@solokit/tool-contract';
import { StorageError, parseSnapshot, type DataStore, type Snapshot, type Workspace, type WorkspaceManager } from '@solokit/storage';
import { createInvoiceStorage } from './repositories';
import { numberSeriesOf } from './series';
import type { InvoiceKind, InvoiceRecord } from './model';
import { FONT_OPTIONS, isPresetThemeId } from './themes';

export interface BackupFile {
  filename: string;
  json: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Optional extras written at the top of a backup file. Older files and older readers simply do without them. */
export interface BackupHeader {
  /** The Business (workspace) the backup was taken from, so a restore into a new Business can name it. */
  workspaceName?: string;
}

/**
 * Exports everything on this device as one JSON file. Nothing on the device changes: the file carries the
 * backup time (so a restore on another device shows the right "last backed up" date), but this device only
 * counts it as backed up once {@link recordBackup} is called, after the file has really been handed over.
 *
 * The file is plain, unencrypted JSON. It holds the seller's bank details, UPI id, logo and every client, so
 * the screen that offers it should tell people to keep it private. The filename date is UTC.
 */
export async function createBackup(store: DataStore, now: Date = new Date(), header: BackupHeader = {}): Promise<BackupFile> {
  const [snapshot, settings] = await Promise.all([store.exportAll(), createInvoiceStorage(store).settings.get()]);
  if (header.workspaceName) snapshot.workspace = { name: header.workspaceName };
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
  /** Agreements (NDAs and services agreements). */
  contracts: number;
  themes: number;
  hasProfile: boolean;
  profileName?: string;
  /** The Business the file was taken from, when the file says so. */
  workspaceName?: string;
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

/** Documents older than quotes have no `kind` at all, or only the first two. */
const INVOICE_KINDS: readonly string[] = ['invoice', 'proforma', 'quote'];

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
    const optionalText = ['validUntil', 'convertedFromId', 'convertedToId'];
    if (
      (invoice['kind'] !== undefined && !INVOICE_KINDS.includes(invoice['kind'] as string)) ||
      optionalText.some((key) => invoice[key] !== undefined && typeof invoice[key] !== 'string')
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
  checkContractRecords(snapshot.collections.contracts);
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
    contracts: snapshot.collections.contracts.length,
    themes: snapshot.collections.themes.length,
    hasProfile: profile !== undefined,
    ...(typeof profile?.name === 'string' ? { profileName: profile.name } : {}),
    ...(snapshot.workspace ? { workspaceName: snapshot.workspace.name } : {}),
  };
}

export interface DeviceComparison {
  /** Invoices on this device that are not in the file (by id): issued and cancelled ones first, then drafts. */
  missing: { id: string; number: string; status: string }[];
  /** How many of those are issued or cancelled (they own an invoice number). */
  missingIssued: number;
  /** Numbers of missing issued or cancelled invoices that appear nowhere in the file, so they could be handed out again. */
  reusableNumbers: string[];
  /** Agreements on this device that are not in the file (by id): final ones first, then drafts. */
  missingContracts: { id: string; title: string; status: string }[];
  /** How many of those are final, which means they may have been signed. */
  missingFinalContracts: number;
  /** The file was made before the newest change on this device (an invoice or an agreement). */
  fileIsOlder: boolean;
}

/** Compares a backup file with what is on this device, so the screen can warn about what a restore would lose. */
export async function compareWithDevice(store: DataStore, text: string): Promise<DeviceComparison> {
  const snapshot = parseSnapshot(parseBackupText(text));
  const [device, deviceContracts] = await Promise.all([store.list<InvoiceRecord>('invoices'), store.list<Contract>('contracts')]);
  const key = (record: { kind?: InvoiceKind; number: string }) => `${numberSeriesOf(record)}|${record.number.trim().toUpperCase()}`;
  const inFileIds = new Set(snapshot.collections.invoices.map((record) => record.id));
  const inFileNumbers = new Set(
    snapshot.collections.invoices.map((record) => {
      const { kind, number } = record as unknown as { kind?: InvoiceKind; number?: unknown };
      return key({ ...(kind ? { kind } : {}), number: String(number ?? '') });
    }),
  );
  const keyOf = new Map(device.map((invoice) => [invoice.id, key(invoice)]));
  const missing = device
    .filter((invoice) => !inFileIds.has(invoice.id))
    .map((invoice) => ({ id: invoice.id, number: invoice.number, status: invoice.status }))
    .sort((a, b) => Number(a.status === 'draft') - Number(b.status === 'draft') || a.number.localeCompare(b.number, undefined, { numeric: true }));
  const owning = missing.filter((invoice) => invoice.status !== 'draft');
  const contractIdsInFile = new Set(snapshot.collections.contracts.map((record) => record.id));
  const missingContracts = deviceContracts
    .filter((contract) => !contractIdsInFile.has(contract.id))
    .map((contract) => ({ id: contract.id, title: contract.title, status: contract.status }))
    .sort((a, b) => Number(a.status !== 'final') - Number(b.status !== 'final') || a.title.localeCompare(b.title, undefined, { numeric: true }));
  const exported = Date.parse(snapshot.exportedAt);
  const newestInvoice = device.reduce((latest, invoice) => Math.max(latest, Date.parse(invoice.updatedAt) || 0), 0);
  const newest = deviceContracts.reduce((latest, contract) => Math.max(latest, Date.parse(contract.updatedAt) || 0), newestInvoice);
  return {
    missing,
    missingIssued: owning.length,
    reusableNumbers: owning.filter((invoice) => !inFileNumbers.has(keyOf.get(invoice.id) ?? '')).map((invoice) => invoice.number),
    missingContracts,
    missingFinalContracts: missingContracts.filter((contract) => contract.status === 'final').length,
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
  await adoptBackupTime(store, parsed);
}

async function adoptBackupTime(store: DataStore, parsed: unknown): Promise<void> {
  const exportedAt = (parsed as { exportedAt?: unknown }).exportedAt;
  if (typeof exportedAt === 'string') {
    const settings = createInvoiceStorage(store);
    if (!(await settings.settings.get()).lastBackupAt) {
      await settings.settings.update({ lastBackupAt: exportedAt });
    }
  }
}

export const RESTORED_BUSINESS_NAME = 'Restored business';

/**
 * Restores a backup file into a brand new Business and leaves every existing Business untouched. The file is checked
 * first, so an invalid file creates nothing; if the import itself fails the new Business is removed again. The new
 * Business is named `options.name`, else the Business named in the file, else the file's business profile, else
 * "Restored business". It does not become the current Business: the caller decides whether to switch.
 */
export async function restoreIntoNewWorkspace(workspaces: WorkspaceManager, text: string, options: { name?: string } = {}): Promise<Workspace> {
  const parsed = parseBackupText(text);
  const snapshot = parseSnapshot(parsed);
  checkRecords(snapshot);
  const profileName = (snapshot.collections.profile[0] as unknown as { name?: unknown } | undefined)?.name;
  const wanted = [options.name, snapshot.workspace?.name, typeof profileName === 'string' ? profileName : undefined].find((name) => name !== undefined && name.trim() !== '');
  const created = await workspaces.create((wanted ?? RESTORED_BUSINESS_NAME).trim().slice(0, 80));
  try {
    const store = await workspaces.openStore(created.id);
    await store.importAll(parsed);
    await adoptBackupTime(store, parsed);
  } catch (error) {
    await workspaces.remove(created.id).catch(() => undefined);
    throw error;
  }
  return created;
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
