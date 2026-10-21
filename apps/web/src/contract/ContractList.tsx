'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { validateContract, type Contract, type ContractKind, type ContractStorage } from '@solokit/tool-contract';
import { isBackupDue, type InvoiceSettings, type InvoiceStorage, type InvoiceTheme } from '@solokit/tool-invoice';
import { Badge, Button, Notice, formatIsoDate } from '@solokit/ui';
import { downloadBlob } from '../invoice/downloads';
import { newId } from '../invoice/ids';
import { defaultExporter, describeExportError, type ContractExporter, type ExportKind } from './exporters';
import { KindBadge, KindCards, kindClasses } from './kinds';
import { themeFor } from './themes';
import styles from './ContractList.module.css';

export interface ContractListProps {
  storage: ContractStorage;
  /** The invoice tool's storage, for the backup time and the themes the documents print with. */
  invoice: InvoiceStorage;
  /** Starts a new agreement of the kind the user chose. */
  onNew: (kind: ContractKind) => void;
  /** Opens a draft in the editor. */
  onEdit: (id: string) => void;
  /** Opens a final agreement, which is read-only. */
  onView: (id: string) => void;
  onOpenBackup?: () => void;
  exporter?: ContractExporter;
  /** The current time. Tests pass a fixed one. */
  now?: () => Date;
}

const realNow = () => new Date();

type Pending = { id: string; action: 'delete' | 'reopen' } | null;

export function StatusBadge({ status }: { status: Contract['status'] }) {
  return status === 'final' ? <Badge tone="success">Final</Badge> : <Badge>Draft</Badge>;
}

/** "Asha Rao Consulting and Northwind Traders", with a placeholder for a party that has no name yet. */
export function partiesLine(contract: Contract): string {
  const names = contract.parties.map((party) => party.name.trim() || 'Not named yet');
  return names.join(' and ');
}

export const displayTitle = (contract: Contract): string => contract.title.trim() || 'Untitled agreement';

export function ContractList({ storage, invoice, onNew, onEdit, onView, onOpenBackup, exporter = defaultExporter, now = realNow }: ContractListProps) {
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [settings, setSettings] = useState<InvoiceSettings | undefined>(undefined);
  const [customThemes, setCustomThemes] = useState<InvoiceTheme[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string } | null>(null);
  const [choosing, setChoosing] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const chooserRef = useRef<HTMLDivElement>(null);
  /** The accessible name of the button that opened a confirmation, so focus can go back to it. */
  const returnTo = useRef<string | null>(null);

  // A two-step confirm replaces the buttons, so move focus to the question and give it back when the user keeps the agreement.
  useEffect(() => {
    if (pending) {
      confirmRef.current?.focus();
    } else if (returnTo.current) {
      const label = returnTo.current;
      returnTo.current = null;
      Array.from(listRef.current?.querySelectorAll<HTMLElement>('button[aria-label]') ?? [])
        .find((button) => button.getAttribute('aria-label') === label)
        ?.focus();
    }
  }, [pending]);

  // A click anywhere outside the open chooser closes it.
  useEffect(() => {
    if (!choosing) return;
    const close = (event: MouseEvent) => {
      if (event.target instanceof Node && !chooserRef.current?.contains(event.target)) setChoosing(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [choosing]);

  const reload = useCallback(async () => {
    const [list, loadedSettings, themes] = await Promise.all([storage.list(), invoice.settings.get(), invoice.themes.list()]);
    setContracts(list);
    setSettings(loadedSettings);
    setCustomThemes(themes);
  }, [storage, invoice]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    reload().catch((error: unknown) => {
      console.error('Could not read the agreements', error);
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [reload, attempt]);

  async function download(contract: Contract, kind: ExportKind) {
    setMessage(null);
    if (contract.status === 'draft') {
      const problems = validateContract(contract).length;
      if (problems > 0) {
        setMessage({ id: contract.id, text: `Finish this draft before you download it: ${problems} ${problems === 1 ? 'thing is' : 'things are'} missing. Open it to see what.` });
        return;
      }
    }
    setBusy(contract.id);
    try {
      const { blob, filename } = await exporter(kind, { contract, theme: themeFor(contract, settings, customThemes) });
      downloadBlob(blob, filename);
    } catch (error) {
      console.error('Could not build the agreement', error);
      setMessage({ id: contract.id, text: describeExportError(error) });
    } finally {
      setBusy(null);
    }
  }

  async function duplicate(contract: Contract) {
    setBusy(contract.id);
    setMessage(null);
    try {
      const copy = await storage.duplicate(contract.id, { id: newId() });
      onEdit(copy.id);
    } catch (error) {
      console.error('Could not duplicate the agreement', error);
      setMessage({ id: contract.id, text: 'The agreement could not be duplicated. Try again.' });
      setBusy(null);
    }
  }

  async function confirm(contract: Contract, action: 'delete' | 'reopen') {
    setBusy(contract.id);
    setMessage(null);
    try {
      if (action === 'reopen') {
        await storage.reopen(contract.id);
        onEdit(contract.id);
        return;
      }
      await storage.remove(contract.id);
      setPending(null);
      await reload();
    } catch (error) {
      console.error('Could not change the agreement', error);
      setMessage({ id: contract.id, text: 'That could not be done. Try again.' });
    } finally {
      setBusy(null);
    }
  }

  if (failed) {
    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <Notice tone="danger" title="Your agreements could not be opened">
          Your browser could not read what was saved on this device.
        </Notice>
        <div>
          <Button onClick={() => setAttempt((count) => count + 1)}>Try again</Button>
        </div>
      </div>
    );
  }
  if (contracts === null) return <p>Opening your agreements…</p>;

  if (contracts.length === 0) {
    return (
      <div className={styles.empty}>
        <h2 style={{ fontSize: '1.5rem' }}>Start your first agreement</h2>
        <p className={styles.lead}>Pick what you need. You fill in the details in plain English, review a summary of your choices, and download a PDF or an editable Word file.</p>
        <KindCards onPick={onNew} label="Choose an agreement type to start with" />
        <p className={styles.hint}>
          Not sure? Use an <strong>NDA</strong> before you discuss a project in detail, and a <strong>services agreement</strong> once the work is agreed.
        </p>
      </div>
    );
  }

  function choose(kind: ContractKind) {
    setChoosing(false);
    onNew(kind);
  }

  return (
    <div>
      <div
        className={styles.header}
        ref={chooserRef}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && choosing) {
            event.stopPropagation();
            setChoosing(false);
            chooserRef.current?.querySelector<HTMLElement>('button[aria-expanded]')?.focus();
          }
        }}
      >
        <h2 style={{ fontSize: '1.5rem' }}>Agreements</h2>
        <Button aria-expanded={choosing} aria-controls="new-agreement-chooser" onClick={() => setChoosing((open) => !open)}>
          <span aria-hidden="true">+</span> New
        </Button>
        {choosing ? (
          <div id="new-agreement-chooser" className={styles.chooser}>
            <KindCards onPick={choose} label="Choose an agreement type" autoFocus />
          </div>
        ) : null}
      </div>
      {isBackupDue(settings?.lastBackupAt, now(), contracts.length > 0) ? (
        <div className={styles.reminder}>
          <Notice tone="warning" title="Back up your agreements">
            {settings?.lastBackupAt ? 'It has been a while since your last backup.' : 'You have not made a backup yet.'} Your agreements are stored only in this browser, so a backup file is your safety net.
            {onOpenBackup ? (
              <>
                {' '}
                <button type="button" className={styles.linkButton} onClick={onOpenBackup}>
                  Back up now
                </button>
              </>
            ) : null}
          </Notice>
        </div>
      ) : null}
      <ul className={styles.list} aria-label="Agreements" role="list" ref={listRef}>
        {contracts.map((contract) => {
          const isPending = pending?.id === contract.id;
          const isBusy = busy === contract.id;
          const title = displayTitle(contract);
          return (
            <li key={contract.id} className={`${kindClasses.scope} ${styles.item}`} data-kind={contract.kind}>
              <div className={styles.top}>
                <span className={styles.ident}>
                  <KindBadge kind={contract.kind} />
                  <span className={styles.title}>{title}</span>
                </span>
                <span className={styles.statuses}>
                  <StatusBadge status={contract.status} />
                </span>
              </div>
              <div className={styles.meta}>
                <span className={styles.parties}>{partiesLine(contract)}</span>
                <span className={styles.dates}>
                  Effective {formatIsoDate(contract.effectiveDate)} · updated {formatIsoDate(contract.updatedAt.slice(0, 10))}
                </span>
              </div>
              {isPending && pending ? (
                <div className={styles.confirm}>
                  <p ref={confirmRef} tabIndex={-1}>
                    {pending.action === 'delete'
                      ? `Delete the draft "${title}"? This cannot be undone.`
                      : `Reopen "${title}"? It becomes a draft again, so you can change it. Its locked wording is dropped, and you finalise it again when you are done.`}
                  </p>
                  <div className={styles.actions}>
                    <Button disabled={isBusy} onClick={() => void confirm(contract, pending.action)}>
                      {pending.action === 'delete' ? 'Yes, delete draft' : 'Yes, reopen'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        returnTo.current = `${pending.action === 'delete' ? 'Delete draft' : 'Reopen'} ${title}`;
                        setPending(null);
                      }}
                    >
                      Keep it
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={styles.actions}>
                  <Button aria-label={`Open ${title}`} onClick={() => (contract.status === 'draft' ? onEdit(contract.id) : onView(contract.id))}>
                    Open
                  </Button>
                  <Button variant="secondary" aria-label={`Download PDF ${title}`} disabled={isBusy} onClick={() => void download(contract, 'pdf')}>
                    {isBusy ? 'Preparing…' : 'Download PDF'}
                  </Button>
                  <Button variant="secondary" aria-label={`Download Word ${title}`} disabled={isBusy} onClick={() => void download(contract, 'docx')}>
                    Download Word
                  </Button>
                  <Button variant="secondary" aria-label={`Review pack ${title}`} disabled={isBusy} onClick={() => void download(contract, 'review-pdf')}>
                    Review pack
                  </Button>
                  <Button variant="ghost" aria-label={`Duplicate ${title}`} disabled={isBusy} onClick={() => void duplicate(contract)}>
                    Duplicate
                  </Button>
                  {contract.status === 'final' ? (
                    <Button variant="ghost" aria-label={`Reopen ${title}`} onClick={() => setPending({ id: contract.id, action: 'reopen' })}>
                      Reopen
                    </Button>
                  ) : (
                    <Button variant="ghost" aria-label={`Delete draft ${title}`} onClick={() => setPending({ id: contract.id, action: 'delete' })}>
                      Delete draft
                    </Button>
                  )}
                </div>
              )}
              {message?.id === contract.id ? <Notice tone="danger">{message.text}</Notice> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
