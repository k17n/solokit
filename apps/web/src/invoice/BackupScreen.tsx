'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { StorageError, type DataStore } from '@solokit/storage';
import { createBackup, createInvoiceStorage, inspectBackup, restoreBackup, type BackupSummary } from '@solokit/tool-invoice';
import { Button, Notice } from '@solokit/ui';
import { downloadBlob } from './downloads';
import styles from './BackupScreen.module.css';

export interface BackupScreenProps {
  store: DataStore;
  /** Called after a restore has replaced the data, so the app can reload what it shows. */
  onRestored: () => void;
  now?: () => Date;
}

const realNow = () => new Date();

interface Counts {
  invoices: number;
  clients: number;
  themes: number;
  hasProfile: boolean;
}

const plural = (count: number, one: string) => `${count} ${count === 1 ? one : `${one}s`}`;

function describeCounts(counts: Counts): string {
  return `${plural(counts.invoices, 'invoice')}, ${plural(counts.clients, 'client')}, ${plural(counts.themes, 'custom theme')}${counts.hasProfile ? ' and your business profile' : ' and no business profile'}`;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsText(file);
  });
}

interface Pending {
  text: string;
  fileName: string;
  summary: BackupSummary;
}

export function BackupScreen({ store, onRestored, now = realNow }: BackupScreenProps) {
  const storage = useMemo(() => createInvoiceStorage(store), [store]);
  const [lastBackupAt, setLastBackupAt] = useState<string | undefined>(undefined);
  const [current, setCurrent] = useState<Counts | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const summaryId = useId();

  const refresh = useCallback(async () => {
    const [settings, invoices, clients, themes, profile] = await Promise.all([
      storage.settings.get(),
      storage.invoices.list(),
      storage.clients.list(),
      storage.themes.list(),
      storage.profile.get(),
    ]);
    setLastBackupAt(settings.lastBackupAt);
    setCurrent({ invoices: invoices.length, clients: clients.length, themes: themes.length, hasProfile: profile !== undefined });
  }, [storage]);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    refresh().catch((error: unknown) => {
      console.error('Could not read what is saved', error);
      if (!cancelled) setLoadFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (pending) summaryRef.current?.focus();
  }, [pending]);

  async function download() {
    setBusy(true);
    setDownloadError(false);
    try {
      // The backup time is recorded as the file is made, so this runs only now, on the click.
      const backup = await createBackup(store, now());
      downloadBlob(new Blob([backup.json], { type: 'application/json' }), backup.filename);
      await refresh();
    } catch (error) {
      console.error('Could not create the backup', error);
      setDownloadError(true);
    } finally {
      setBusy(false);
    }
  }

  async function choose(file: File | undefined) {
    setFileError(null);
    setPending(null);
    setRestored(false);
    setRestoreError(null);
    if (!file) return;
    try {
      const text = await readText(file);
      setPending({ text, fileName: file.name, summary: inspectBackup(text) });
    } catch (error) {
      setFileError(error instanceof StorageError ? error.message : 'That file could not be read.');
    }
  }

  async function confirmRestore() {
    if (!pending) return;
    setBusy(true);
    setRestoreError(null);
    try {
      await restoreBackup(store, pending.text);
      setPending(null);
      if (fileInput.current) fileInput.current.value = '';
      await refresh();
      setRestored(true);
      onRestored();
    } catch (error) {
      console.error('Could not restore the backup', error);
      setRestoreError(error instanceof StorageError ? error.message : 'The backup could not be restored. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.screen}>
      <h2 style={{ fontSize: '1.8rem' }}>Backup &amp; restore</h2>
      <p className={styles.lede}>
        Everything is saved only in this browser. If you clear your browser data or lose this device, it is gone. A backup file lets you keep a copy somewhere safe and bring it back on any device.
      </p>

      {loadFailed ? (
        <Notice tone="danger" title="Your saved data could not be read">
          Your browser could not read what was saved on this device. Reload the page and try again.
        </Notice>
      ) : null}

      <section className={styles.card} aria-labelledby={`${summaryId}-download`}>
        <h3 id={`${summaryId}-download`} style={{ fontSize: '1.25rem' }}>
          Download a backup
        </h3>
        <Notice tone="warning" title="Keep this file private">
          The backup file is not encrypted. Anyone who gets it can read your bank details, UPI ID, clients and invoices. Store it somewhere private and do not email or share it.
        </Notice>
        <p className={styles.status}>
          {current === null
            ? 'Checking…'
            : lastBackupAt
              ? `Last backup: ${formatWhen(lastBackupAt)}`
              : 'Never backed up on this device.'}
        </p>
        <div>
          <Button disabled={busy || loadFailed} onClick={() => void download()}>
            Download backup
          </Button>
        </div>
        {downloadError ? <Notice tone="danger">The backup could not be created. Try again.</Notice> : null}
      </section>

      <section className={styles.card} aria-labelledby={`${summaryId}-restore`}>
        <h3 id={`${summaryId}-restore`} style={{ fontSize: '1.25rem' }}>
          Restore from a backup
        </h3>
        <p>Restoring replaces everything on this device with the contents of the backup file. Nothing changes until you confirm.</p>
        <div className={styles.fileRow}>
          <label htmlFor={`${summaryId}-file`}>Backup file</label>
          <input
            id={`${summaryId}-file`}
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(event) => void choose(event.target.files?.[0])}
          />
        </div>
        {fileError ? <Notice tone="danger" title="This file cannot be restored">{fileError}</Notice> : null}

        {pending ? (
          <section className={styles.confirm} aria-labelledby={`${summaryId}-summary`} ref={summaryRef} tabIndex={-1}>
            <h4 id={`${summaryId}-summary`} style={{ fontSize: '1.1rem' }}>
              Restore this backup?
            </h4>
            <ul>
              <li>
                File: {pending.fileName}, made {formatWhen(pending.summary.exportedAt)}
                {pending.summary.profileName ? ` for ${pending.summary.profileName}` : ''}.
              </li>
              <li>The backup holds {describeCounts(pending.summary)}.</li>
              {current ? <li>This device now holds {describeCounts(current)}. All of it will be replaced.</li> : null}
            </ul>
            {!pending.summary.hasProfile ? (
              <Notice tone="warning">This backup has no business profile, so you will be asked to set it up again.</Notice>
            ) : null}
            {restoreError ? <Notice tone="danger">{restoreError}</Notice> : null}
            <div className={styles.actions}>
              <Button disabled={busy} onClick={() => void confirmRestore()}>
                Yes, replace my data
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setPending(null);
                  if (fileInput.current) {
                    fileInput.current.value = '';
                    fileInput.current.focus();
                  }
                }}
              >
                Cancel
              </Button>
            </div>
          </section>
        ) : null}

        {restored ? <Notice tone="info">Backup restored. Everything on this device now matches the file.</Notice> : null}
      </section>
    </div>
  );
}
