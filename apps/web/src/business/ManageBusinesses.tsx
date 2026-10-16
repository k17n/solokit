'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Workspace } from '@solokit/storage';
import { createContractStorage } from '@solokit/tool-contract';
import { createBackup, createInvoiceStorage, recordBackup } from '@solokit/tool-invoice';
import { Badge, Button, Notice, TextField } from '@solokit/ui';
import { downloadBlob } from '../invoice/downloads';
import { useWorkspaces } from '../workspace/WorkspaceProvider';
import { useGuardedSwitch } from '../workspace/useGuardedSwitch';
import styles from './ManageBusinesses.module.css';

interface Counts {
  invoices: number;
  agreements: number;
  clients: number;
}

const plural = (count: number, one: string) => `${count} ${count === 1 ? one : `${one}s`}`;

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'That did not work. Try again.';
}

type FocusTarget = { id: string; action: 'rename' | 'archive' | 'delete' } | { heading: true };

/** What deleting a Business erases, in words, with counts when they could be read. */
function erasedBy(name: string, counts: Counts | null): string {
  const things = counts
    ? `its business details and logo, ${plural(counts.invoices, 'invoice or quote')}, ${plural(counts.agreements, 'agreement')}, ${plural(counts.clients, 'saved client')}, its themes and its settings`
    : 'its business details and logo, its invoices and quotes, its agreements, its saved clients, its themes and its settings';
  return `This erases "${name}" from this device: ${things}. It cannot be undone. Other businesses are not touched, and backup files you downloaded stay where you saved them.`;
}

export interface ManageBusinessesProps {
  now?: () => Date;
}

/** The list of Businesses with rename, archive and delete. Delete asks twice: a warning that names what goes, then the name typed in. */
export function ManageBusinesses({ now = () => new Date() }: ManageBusinessesProps) {
  const { ready, workspaces, current, manager, rename, archive, unarchive, remove } = useWorkspaces();
  const switchTo = useGuardedSwitch();
  const headingId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'done' | 'failed'>('idle');
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  /** Numbers the requests for "what is in this business", so an answer that arrives late is ignored. */
  const countRequest = useRef(0);
  /** The business whose store was opened only to count what is in it. */
  const probed = useRef<string | null>(null);
  const currentId = useRef<string | null>(null);
  currentId.current = current?.id ?? null;

  /** Lets go of the connection opened for counting, unless that business is the one on screen (its store is in use). */
  const releaseProbe = useCallback(
    (id: string) => {
      if (id === currentId.current) return;
      if (probed.current === id) probed.current = null;
      void manager?.release(id).catch(() => undefined);
    },
    [manager],
  );

  useEffect(
    () => () => {
      countRequest.current++;
      if (probed.current) releaseProbe(probed.current);
    },
    [releaseProbe],
  );

  function stopCounting(id: string) {
    countRequest.current++;
    releaseProbe(id);
  }

  useEffect(() => {
    if (!focusTarget) return;
    if ('heading' in focusTarget) headingRef.current?.focus();
    else listRef.current?.querySelector<HTMLElement>(`[data-row="${focusTarget.id}"] [data-action="${focusTarget.action}"]`)?.focus();
    setFocusTarget(null);
  }, [focusTarget]);

  useEffect(() => {
    if (deleting) confirmRef.current?.focus();
  }, [deleting]);

  const activeCount = workspaces.filter((workspace) => workspace.archivedAt === undefined).length;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setProblem(null);
    setDone(null);
    try {
      await action();
    } catch (error) {
      console.error('Could not change the businesses', error);
      setProblem(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function startDelete(workspace: Workspace) {
    const request = ++countRequest.current;
    if (probed.current && probed.current !== workspace.id) releaseProbe(probed.current);
    probed.current = workspace.id;
    setDeleting(workspace.id);
    setTyped('');
    setCounts(null);
    setCopyState('idle');
    setDone(null);
    setProblem(null);
    try {
      const store = await manager?.openStore(workspace.id);
      if (!store) return;
      const invoice = createInvoiceStorage(store);
      const [invoices, agreements, clients] = await Promise.all([invoice.invoices.list(), createContractStorage(store).list(), invoice.clients.list()]);
      // The person has moved on (kept it, picked another business, left the page): this answer is stale.
      if (request !== countRequest.current) {
        if (probed.current !== workspace.id) releaseProbe(workspace.id);
        return;
      }
      setCounts({ invoices: invoices.length, agreements: agreements.length, clients: clients.length });
    } catch (error) {
      console.error('Could not count what is in the business', error);
      if (request !== countRequest.current && probed.current !== workspace.id) releaseProbe(workspace.id);
    }
  }

  async function downloadCopy(workspace: Workspace) {
    setBusy(true);
    setCopyState('idle');
    try {
      const store = await manager?.openStore(workspace.id);
      if (!store) throw new Error('no store');
      const stamp = now();
      const backup = await createBackup(store, stamp, { workspaceName: workspace.name });
      downloadBlob(new Blob([backup.json], { type: 'application/json' }), backup.filename);
      await recordBackup(store, stamp);
      setCopyState('done');
    } catch (error) {
      console.error('Could not back up the business', error);
      setCopyState('failed');
    } finally {
      setBusy(false);
    }
  }

  function submitRename(event: FormEvent, workspace: Workspace) {
    event.preventDefault();
    void run(async () => {
      try {
        await rename(workspace.id, renameValue);
      } catch (error) {
        setRenameError(messageOf(error));
        return;
      }
      setRenaming(null);
      setRenameError(null);
      setDone(`Renamed to "${renameValue.replace(/\s+/g, ' ').trim()}".`);
      setFocusTarget({ id: workspace.id, action: 'rename' });
    });
  }

  if (!ready) return null;

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
        Your businesses
      </h2>
      <p className={styles.lede}>
        Each business keeps its own details, invoices, agreements, clients and themes in a separate place in this browser. Nothing is shared between them. Archiving hides a business from the switcher and keeps its data. Deleting erases it from this device only.
      </p>
      <p>
        <a href="#add">+ Add a business</a>
      </p>

      <ul className={styles.list} ref={listRef} aria-label="Your businesses">
        {workspaces.map((workspace) => {
          const isCurrent = workspace.id === current?.id;
          const archived = workspace.archivedAt !== undefined;
          const onlyActive = !archived && activeCount <= 1;
          return (
            <li key={workspace.id} className={styles.row} data-row={workspace.id}>
              <div className={styles.rowHead}>
                <span className={styles.name}>{workspace.name}</span>
                {isCurrent ? <Badge tone="success">Current</Badge> : null}
                {archived ? <Badge>Archived</Badge> : null}
              </div>

              {renaming === workspace.id ? (
                <form className={styles.inline} onSubmit={(event) => submitRename(event, workspace)} noValidate>
                  <TextField label="Business name" autoComplete="off" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} error={renameError ?? undefined} autoFocus />
                  <div className={styles.actions}>
                    <Button type="submit" disabled={busy}>
                      Save name
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setRenaming(null);
                        setRenameError(null);
                        setFocusTarget({ id: workspace.id, action: 'rename' });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.action}
                    data-action="rename"
                    disabled={busy}
                    onClick={() => {
                      setRenaming(workspace.id);
                      setRenameValue(workspace.name);
                      setRenameError(null);
                      setDone(null);
                    }}
                  >
                    Rename<span className="sr-only"> {workspace.name}</span>
                  </button>
                  {!isCurrent && !archived ? (
                    <button type="button" className={styles.action} disabled={busy} onClick={() => void run(async () => void (await switchTo(workspace.id)))}>
                      Switch to<span className="sr-only"> {workspace.name}</span>
                    </button>
                  ) : null}
                  {archived ? (
                    <button
                      type="button"
                      className={styles.action}
                      data-action="archive"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await unarchive(workspace.id);
                          setDone(`"${workspace.name}" is back in the switcher.`);
                          setFocusTarget({ id: workspace.id, action: 'archive' });
                        })
                      }
                    >
                      Unarchive<span className="sr-only"> {workspace.name}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.action}
                      data-action="archive"
                      disabled={busy || onlyActive}
                      onClick={() =>
                        void run(async () => {
                          await archive(workspace.id);
                          setDone(`"${workspace.name}" is archived. Its data is kept.`);
                          setFocusTarget({ id: workspace.id, action: 'archive' });
                        })
                      }
                    >
                      Archive<span className="sr-only"> {workspace.name}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${styles.action} ${styles.danger}`}
                    data-action="delete"
                    disabled={busy || onlyActive}
                    onClick={() => void startDelete(workspace)}
                  >
                    Delete<span className="sr-only"> {workspace.name}</span>
                  </button>
                </div>
              )}
              {onlyActive ? <p className={styles.note}>This is your only business, so it cannot be archived or deleted. Add another business first.</p> : null}

              {deleting === workspace.id ? (
                <div className={styles.confirm} role="group" aria-labelledby={`${headingId}-confirm`} ref={confirmRef} tabIndex={-1}>
                  <p id={`${headingId}-confirm`} className={styles.confirmTitle}>
                    Delete &ldquo;{workspace.name}&rdquo; for good?
                  </p>
                  <p>{erasedBy(workspace.name, counts)}</p>
                  <div>
                    <Button variant="secondary" disabled={busy} onClick={() => void downloadCopy(workspace)}>
                      Download a backup of this business first
                    </Button>
                  </div>
                  {copyState === 'done' ? <Notice tone="info">A backup of &ldquo;{workspace.name}&rdquo; was downloaded.</Notice> : null}
                  {copyState === 'failed' ? <Notice tone="danger">The backup could not be created. Try again.</Notice> : null}
                  <TextField
                    label={`Type the business name to confirm: ${workspace.name}`}
                    autoComplete="off"
                    spellCheck={false}
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                  />
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.confirmDelete}
                      disabled={busy || typed.trim() !== workspace.name}
                      onClick={() =>
                        void run(async () => {
                          const wasCurrent = isCurrent;
                          countRequest.current++;
                          probed.current = null;
                          await remove(workspace.id);
                          setDeleting(null);
                          setDone(`Deleted "${workspace.name}" from this device.${wasCurrent ? ' Now showing another business.' : ''}`);
                          setFocusTarget({ heading: true });
                        })
                      }
                    >
                      Delete &ldquo;{workspace.name}&rdquo; forever
                    </button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setDeleting(null);
                        stopCounting(workspace.id);
                        setFocusTarget({ id: workspace.id, action: 'delete' });
                      }}
                    >
                      Keep it
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {problem ? <Notice tone="danger">{problem}</Notice> : null}
      {done ? (
        <p role="status" className={styles.done}>
          {done}
        </p>
      ) : null}
    </section>
  );
}
