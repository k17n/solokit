'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { StorageError, type DataStore } from '@solokit/storage';
import { createContractStorage } from '@solokit/tool-contract';
import {
  MAX_BACKUP_BYTES,
  compareWithDevice,
  createBackup,
  createInvoiceStorage,
  inspectBackup,
  recordBackup,
  restoreBackup,
  restoreIntoNewWorkspace,
  type BackupSummary,
  type DeviceComparison,
} from '@solokit/tool-invoice';
import { Button, Notice } from '@solokit/ui';
import { useOptionalWorkspaces, useStorage } from '../workspace/WorkspaceProvider';
import { downloadBlob } from '../invoice/downloads';
import { readText } from './files';
import styles from './BackupScreen.module.css';

export interface BackupScreenProps {
  store: DataStore;
  /** Called after a restore has replaced the data, so the app can reload what it shows. */
  onRestored: (summary: BackupSummary) => void;
  /** Leaves out the download section, for a device that has nothing to back up yet. */
  restoreOnly?: boolean;
  now?: () => Date;
}

const realNow = () => new Date();

interface Counts {
  invoices: number;
  clients: number;
  contracts: number;
  themes: number;
  hasProfile: boolean;
}

const plural = (count: number, one: string) => `${count} ${count === 1 ? one : `${one}s`}`;

function describeCounts(counts: Counts): string {
  return `${plural(counts.invoices, 'invoice')}, ${plural(counts.contracts, 'agreement')}, ${plural(counts.clients, 'client')}, ${plural(counts.themes, 'custom theme')}${counts.hasProfile ? ' and your business profile' : ' and no business profile'}`;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

interface Pending {
  text: string;
  fileName: string;
  summary: BackupSummary;
  comparison: DeviceComparison;
}

/** True when there is anything on the device that a replacing restore would delete. Unknown counts count as data. */
function hasData(counts: Counts | null): boolean {
  return counts === null || counts.invoices + counts.contracts + counts.clients + counts.themes > 0 || counts.hasProfile;
}

function listTitles(titles: string[]): string {
  const shown = titles.slice(0, 10).map((title) => `"${title || 'Untitled'}"`).join(', ');
  return titles.length > 10 ? `${shown} and ${titles.length - 10} more` : shown;
}

function listNumbers(numbers: string[]): string {
  const shown = numbers.slice(0, 10).join(', ');
  return numbers.length > 10 ? `${shown} and ${numbers.length - 10} more` : shown;
}

export function BackupScreen({ store, onRestored, restoreOnly = false, now = realNow }: BackupScreenProps) {
  const { workspace } = useStorage();
  const workspaces = useOptionalWorkspaces();
  const header = workspace ? { workspaceName: workspace.name } : {};
  /** Both restore choices need the list of Businesses; without it (and on the first-run screen) the backup replaces what is here. */
  const canRestoreAsNew = !restoreOnly && workspaces?.manager != null && workspace !== null;
  const businessLabel = workspace ? `"${workspace.name}"` : 'this device';
  const storage = useMemo(() => createInvoiceStorage(store), [store]);
  const contractStorage = useMemo(() => createContractStorage(store), [store]);
  const [lastBackupAt, setLastBackupAt] = useState<string | undefined>(undefined);
  const [current, setCurrent] = useState<Counts | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restored, setRestored] = useState<BackupSummary | null>(null);
  const [safetyCopy, setSafetyCopy] = useState<'idle' | 'done' | 'failed'>('idle');
  const [asNew, setAsNew] = useState<{ id: string; name: string } | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const summaryId = useId();

  const refresh = useCallback(async () => {
    const [settings, invoices, contracts, clients, themes, profile] = await Promise.all([
      storage.settings.get(),
      storage.invoices.list(),
      contractStorage.list(),
      storage.clients.list(),
      storage.themes.list(),
      storage.profile.get(),
    ]);
    setLastBackupAt(settings.lastBackupAt);
    setCurrent({ invoices: invoices.length, contracts: contracts.length, clients: clients.length, themes: themes.length, hasProfile: profile !== undefined });
  }, [storage, contractStorage]);

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

  useEffect(() => {
    if (restored || asNew) restoredRef.current?.focus();
  }, [restored, asNew]);

  async function download() {
    setBusy(true);
    setDownloadError(false);
    try {
      // The backup time is recorded as the file is made, so this runs only now, on the click.
      const stamp = now();
      const backup = await createBackup(store, stamp, header);
      downloadBlob(new Blob([backup.json], { type: 'application/json' }), backup.filename);
      // Only a file that was really handed over counts as a backup.
      await recordBackup(store, stamp);
      await refresh();
    } catch (error) {
      console.error('Could not create the backup', error);
      setDownloadError(true);
    } finally {
      setBusy(false);
    }
  }

  async function downloadSafetyCopy() {
    setBusy(true);
    setSafetyCopy('idle');
    try {
      const stamp = now();
      const backup = await createBackup(store, stamp, header);
      downloadBlob(new Blob([backup.json], { type: 'application/json' }), backup.filename);
      await recordBackup(store, stamp);
      await refresh();
      setSafetyCopy('done');
    } catch (error) {
      console.error('Could not create the backup of the current data', error);
      setSafetyCopy('failed');
    } finally {
      setBusy(false);
    }
  }

  async function choose(file: File | undefined) {
    setFileError(null);
    setPending(null);
    setRestored(null);
    setAsNew(null);
    setRestoreError(null);
    setSafetyCopy('idle');
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setFileError(`This file is too large to be a SoloKit backup (the limit is ${MAX_BACKUP_BYTES / (1024 * 1024)} MB).`);
      return;
    }
    try {
      const text = await readText(file);
      const summary = inspectBackup(text);
      const comparison = await compareWithDevice(store, text);
      setPending({ text, fileName: file.name, summary, comparison });
    } catch (error) {
      setFileError(error instanceof StorageError ? error.message : 'That file could not be read.');
    }
  }

  async function confirmRestoreAsNew() {
    if (!pending || !workspaces?.manager) return;
    setBusy(true);
    setRestoreError(null);
    try {
      // A copy of a business that is still here gets a different name, so the two can be told apart in the switcher.
      const wanted = (pending.summary.workspaceName ?? pending.summary.profileName ?? 'Restored business').trim();
      const taken = new Set(workspaces.workspaces.map((other) => other.name.trim().toLowerCase()));
      let name = wanted;
      for (let n = 1; taken.has(name.toLowerCase()); n++) name = n === 1 ? `${wanted} (restored)` : `${wanted} (restored ${n})`;
      const created = await restoreIntoNewWorkspace(workspaces.manager, pending.text, { name });
      setPending(null);
      if (fileInput.current) fileInput.current.value = '';
      await workspaces.refresh();
      setAsNew({ id: created.id, name: created.name });
    } catch (error) {
      console.error('Could not restore the backup into a new business', error);
      setRestoreError(error instanceof StorageError ? error.message : 'The backup could not be restored. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmRestore() {
    if (!pending) return;
    setBusy(true);
    setRestoreError(null);
    try {
      await restoreBackup(store, pending.text);
      const summary = pending.summary;
      setPending(null);
      if (fileInput.current) fileInput.current.value = '';
      await refresh();
      setRestored(summary);
      onRestored(summary);
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
      {workspace ? (
        <p className={styles.lede}>
          A backup covers one business at a time. You are working in <strong>{workspace.name}</strong>, so that is the business you back up and restore here. The file records the business name.
        </p>
      ) : null}

      {loadFailed ? (
        <Notice tone="danger" title="Your saved data could not be read">
          Your browser could not read what was saved on this device. Reload the page and try again.
        </Notice>
      ) : null}

      {restoreOnly ? null : (
      <section className={styles.card} aria-labelledby={`${summaryId}-download`}>
        <h3 id={`${summaryId}-download`} style={{ fontSize: '1.25rem' }}>
          Download a backup
        </h3>
        <Notice tone="warning" title="Keep this file private">
          The backup file is not encrypted. Anyone who gets it can read your bank details, UPI ID, clients, invoices and agreements. Store it somewhere private and do not email or share it.
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
      )}

      <section className={styles.card} aria-labelledby={`${summaryId}-restore`}>
        <h3 id={`${summaryId}-restore`} style={{ fontSize: '1.25rem' }}>
          Restore from a backup
        </h3>
        <p>
          {canRestoreAsNew
            ? `You can restore a backup as a new business, which leaves ${businessLabel} and every other business as they are, or replace ${businessLabel} with it. Nothing changes until you confirm.`
            : 'Restoring replaces everything on this device with the contents of the backup file. Nothing changes until you confirm.'}
        </p>
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
              {current ? (
                <li>
                  {workspace ? `${businessLabel} now holds` : 'This device now holds'} {describeCounts(current)}.{' '}
                  {canRestoreAsNew ? `Replacing ${businessLabel} deletes all of it. Restoring as a new business deletes nothing.` : 'All of it will be replaced.'}
                </li>
              ) : null}
            </ul>
            <LossWarning comparison={pending.comparison} />
            <div>
              <Button variant="secondary" disabled={busy} onClick={() => void downloadSafetyCopy()}>
                Download a backup of the current data first
              </Button>
            </div>
            {safetyCopy === 'done' ? <Notice tone="info">A backup of the data now on this device was downloaded.</Notice> : null}
            {safetyCopy === 'failed' ? <Notice tone="danger">The backup of the current data could not be created. Try again.</Notice> : null}
            {!pending.summary.hasProfile ? (
              <Notice tone="warning">This backup has no business profile, so you will be asked to set it up again.</Notice>
            ) : null}
            {restoreError ? <Notice tone="danger">{restoreError}</Notice> : null}
            <div className={styles.actions}>
              {canRestoreAsNew && hasData(current) ? (
                <Button disabled={busy} onClick={() => void confirmRestoreAsNew()}>
                  Restore as a new business
                </Button>
              ) : null}
              <Button variant={canRestoreAsNew && hasData(current) ? 'secondary' : 'primary'} disabled={busy} onClick={() => void confirmRestore()}>
                {canRestoreAsNew ? `Yes, replace ${businessLabel}` : 'Yes, replace my data'}
              </Button>
              {canRestoreAsNew && !hasData(current) ? (
                <Button variant="secondary" disabled={busy} onClick={() => void confirmRestoreAsNew()}>
                  Restore as a new business
                </Button>
              ) : null}
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

        {asNew ? (
          <div ref={restoredRef} tabIndex={-1}>
            <Notice tone="info" title="Backup restored as a new business">
              <p>
                &ldquo;{asNew.name}&rdquo; now holds the backup. {businessLabel} was not changed.
              </p>
              <p>
                <Button variant="secondary" onClick={() => void workspaces?.switchTo(asNew.id)}>
                  Switch to {asNew.name}
                </Button>
              </p>
            </Notice>
          </div>
        ) : null}

        {restored ? (
          <div ref={restoredRef} tabIndex={-1}>
            <Notice tone="info">
              Backup restored. Everything on this device now matches the file.
              {restored.hasProfile ? '' : ' The backup had no business profile, so complete setup to continue.'}
            </Notice>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function LossWarning({ comparison }: { comparison: DeviceComparison }) {
  const { missing, missingIssued, reusableNumbers, fileIsOlder, missingContracts, missingFinalContracts } = comparison;
  const drafts = missing.length - missingIssued;
  const draftAgreements = missingContracts.length - missingFinalContracts;
  if (missing.length === 0 && missingContracts.length === 0 && !fileIsOlder) return null;
  const owning = missing.filter((invoice) => invoice.status !== 'draft').map((invoice) => invoice.number);
  const finalAgreements = missingContracts.filter((contract) => contract.status === 'final').map((contract) => contract.title);
  const lostThings = [missingIssued > 0 ? plural(missingIssued, 'issued invoice') : '', missingFinalContracts > 0 ? plural(missingFinalContracts, 'final agreement') : ''].filter(Boolean);
  return (
    <Notice tone="danger" title={lostThings.length > 0 ? `${lostThings.join(' and ')} on this device would be lost` : 'This backup is older than the data on this device'}>
      {missingIssued > 0 ? <p>These invoices are on this device but not in the backup file, and restoring will delete them: {listNumbers(owning)}.</p> : null}
      {reusableNumbers.length > 0 ? (
        <p>Their numbers ({listNumbers(reusableNumbers)}) would be free again, so new invoices could reuse them. Reusing an invoice number you already gave to a client can cause trouble with GST records.</p>
      ) : null}
      {drafts > 0 ? <p>{plural(drafts, 'draft')} that is not in the backup would also be deleted.</p> : null}
      {missingFinalContracts > 0 ? (
        <p>
          These final agreements are on this device but not in the backup file, and restoring will delete them: <strong>{listTitles(finalAgreements)}</strong>. They may already be signed.
        </p>
      ) : null}
      {draftAgreements > 0 ? <p>{plural(draftAgreements, 'draft agreement')} that is not in the backup would also be deleted: {listTitles(missingContracts.filter((contract) => contract.status !== 'final').map((contract) => contract.title))}.</p> : null}
      {fileIsOlder ? <p>The file was made before the latest changes on this device, so anything changed since then would be lost.</p> : null}
      <p>If you are not sure, download a backup of the current data first.</p>
    </Notice>
  );
}
