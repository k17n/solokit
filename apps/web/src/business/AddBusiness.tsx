'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { StorageError, type Workspace } from '@solokit/storage';
import { MAX_BACKUP_BYTES, inspectBackup, restoreIntoNewWorkspace, type BackupSummary } from '@solokit/tool-invoice';
import { Button, Notice, TextField } from '@solokit/ui';
import { useWorkspaces } from '../workspace/WorkspaceProvider';
import { readText } from './files';
import styles from './AddBusiness.module.css';

export interface AddBusinessProps {
  /** Called once the new Business exists and is the current one. */
  onCreated: (workspace: Workspace) => void;
  onCancel: () => void;
}

interface Chosen {
  text: string;
  fileName: string;
  summary: BackupSummary;
}

const plural = (count: number, one: string) => `${count} ${count === 1 ? one : `${one}s`}`;

/** A new Business: a name first, then the same setup as any other. A backup file can start a Business instead. */
export function AddBusiness({ onCreated, onCancel }: AddBusinessProps) {
  const { create, switchTo, manager, registryPersistent } = useWorkspaces();
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [restoreName, setRestoreName] = useState('');

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function createBlank(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (name.trim() === '') {
      setNameError('Enter a name for the business');
      return;
    }
    setBusy(true);
    setNameError(null);
    setProblem(null);
    try {
      const created = await create(name);
      onCreated(created);
    } catch (error) {
      console.error('Could not create the business', error);
      setProblem(error instanceof Error ? error.message : 'The business could not be created. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function chooseFile(file: File | undefined) {
    setChosen(null);
    setFileError(null);
    setProblem(null);
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setFileError(`This file is too large to be a SoloKit backup (the limit is ${MAX_BACKUP_BYTES / (1024 * 1024)} MB).`);
      return;
    }
    try {
      const text = await readText(file);
      const summary = inspectBackup(text);
      setChosen({ text, fileName: file.name, summary });
      setRestoreName(summary.workspaceName ?? summary.profileName ?? '');
    } catch (error) {
      setFileError(error instanceof StorageError ? error.message : 'That file could not be read.');
    }
  }

  async function restore() {
    if (!chosen || !manager || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const created = await restoreIntoNewWorkspace(manager, chosen.text, restoreName.trim() ? { name: restoreName } : {});
      await switchTo(created.id);
      onCreated(created);
    } catch (error) {
      console.error('Could not restore the backup into a new business', error);
      setProblem(error instanceof StorageError || error instanceof Error ? error.message : 'The backup could not be restored. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
        Add a business
      </h2>
      <p className={styles.lede}>
        A new business starts empty, with its own details, invoices, agreements, clients and themes. Your other businesses are not touched. You set it up next.
      </p>
      {!registryPersistent ? (
        <Notice tone="warning" title="Your browser is not saving the list of businesses">
          A business you add now will be gone when you close this tab.
        </Notice>
      ) : null}

      <form className={styles.card} onSubmit={createBlank} noValidate>
        <TextField label="Business name" required autoComplete="organization" hint="This is how it appears in the switcher. You can change it later." value={name} onChange={(event) => setName(event.target.value)} error={nameError ?? undefined} />
        <div className={styles.actions}>
          <Button type="submit" disabled={busy}>
            Create business
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>

      <div className={styles.card}>
        <h3 className={styles.sub}>Or restore a backup into a new business</h3>
        <p>Pick a SoloKit backup file. It becomes a new business and everything already on this device is left as it is.</p>
        <div className={styles.fileRow}>
          <label htmlFor={`${headingId}-file`}>Backup file</label>
          <input id={`${headingId}-file`} type="file" accept="application/json,.json" disabled={busy} onChange={(event) => void chooseFile(event.target.files?.[0])} />
        </div>
        {fileError ? <Notice tone="danger" title="This file cannot be restored">{fileError}</Notice> : null}
        {chosen ? (
          <div className={styles.chosen}>
            <p>
              {chosen.fileName} holds {plural(chosen.summary.invoices, 'invoice')}, {plural(chosen.summary.contracts, 'agreement')}, {plural(chosen.summary.clients, 'client')} and{' '}
              {chosen.summary.hasProfile ? 'a business profile' : 'no business profile'}
              {chosen.summary.workspaceName ? `. It was taken from the business "${chosen.summary.workspaceName}"` : ''}.
            </p>
            <TextField label="Name of the new business" autoComplete="off" value={restoreName} onChange={(event) => setRestoreName(event.target.value)} />
            <div>
              <Button disabled={busy} onClick={() => void restore()}>
                Restore as a new business
              </Button>
            </div>
          </div>
        ) : null}
        {problem ? <Notice tone="danger">{problem}</Notice> : null}
      </div>
    </section>
  );
}
