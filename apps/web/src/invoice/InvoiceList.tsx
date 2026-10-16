'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConversionError, buildInvoiceDocument, KIND_LABEL, isBackupDue, resolveTheme, seriesOf, type InvoiceKind, type InvoiceRecord, type InvoiceStorage, type InvoiceTheme } from '@solokit/tool-invoice';
import { type BusinessProfile } from '@solokit/profile';
import { Badge, Button, Notice, formatIsoDate } from '@solokit/ui';
import { KindBadge, KindCards, convertLabel, kindClasses } from './kinds';
import { downloadBlob } from './downloads';
import { duplicateInvoice, todayIso } from './editorModel';
import { newId } from './ids';
import { invoiceFileName } from './fileName';
import { defaultPdfRenderer, type PdfRenderer } from './usePdfPreview';
import styles from './InvoiceList.module.css';

export interface InvoiceListProps {
  storage: InvoiceStorage;
  /** Starts a new document of the kind the user chose. */
  onNew: (kind: InvoiceKind) => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  /** Opens the backup screen from the reminder. */
  onOpenBackup?: () => void;
  renderPdf?: PdfRenderer;
  /** The current time. Tests pass a fixed one. */
  now?: () => Date;
}

const realNow = () => new Date();

type Pending = { id: string; action: 'cancel' | 'delete' } | null;

type Filter = 'all' | InvoiceKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'quote', label: 'Quotations' },
  { value: 'proforma', label: 'Proformas' },
];

const EMPTY_TEXT: Record<InvoiceKind, string> = { invoice: 'No invoices yet.', quote: 'No quotations yet.', proforma: 'No proforma invoices yet.' };

/** The lower-case name of a document's kind, for sentences: "invoice", "proforma invoice", "quotation". */
export const kindNoun = (kind: InvoiceKind | undefined): string => KIND_LABEL[kind ?? 'invoice'].toLowerCase();

export function totalOf(invoice: InvoiceRecord): string {
  try {
    const rows = buildInvoiceDocument(invoice).totals;
    return rows.find((row) => row.emphasis === 'total')?.amount ?? '–';
  } catch {
    return '–';
  }
}

export { KindBadge };

/** Shown beside the status of a quotation or proforma that has been turned into an invoice. */
export function ConvertedBadge({ invoice }: { invoice: InvoiceRecord }) {
  return invoice.convertedToId ? <Badge tone="success">Converted</Badge> : null;
}

export function StatusBadge({ status }: { status: InvoiceRecord['status'] }) {
  if (status === 'issued') return <Badge tone="success">Issued</Badge>;
  if (status === 'cancelled') return <Badge tone="soon">Cancelled</Badge>;
  return <Badge>Draft</Badge>;
}

export function InvoiceList({ storage, onNew, onEdit, onView, onOpenBackup, renderPdf = defaultPdfRenderer, now = realNow }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<InvoiceRecord[] | null>(null);
  const [customThemes, setCustomThemes] = useState<InvoiceTheme[]>([]);
  const [lastBackupAt, setLastBackupAt] = useState<string | undefined>(undefined);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string } | null>(null);
  const [choosing, setChoosing] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const chooserRef = useRef<HTMLDivElement>(null);
  /** The accessible name of the button that opened a confirmation, so focus can go back to it. */
  const returnTo = useRef<string | null>(null);

  // A two-step confirm replaces the buttons, so move focus to the question and give it back when the user keeps the invoice.
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
    const [list, themes, settings, seller] = await Promise.all([storage.invoices.list(), storage.themes.list(), storage.settings.get(), storage.profile.get()]);
    setInvoices(list);
    setLastBackupAt(settings.lastBackupAt);
    setCustomThemes(themes);
    setProfile(seller ?? null);
  }, [storage]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    reload().catch((error: unknown) => {
      console.error('Could not read the invoices', error);
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [reload, attempt]);

  async function download(invoice: InvoiceRecord) {
    setBusy(invoice.id);
    setMessage(null);
    try {
      const blob = await renderPdf({ invoice, theme: invoice.themeSnapshot ?? resolveTheme(invoice.themeId, customThemes) });
      downloadBlob(blob, invoiceFileName(invoice));
    } catch (error) {
      console.error('Could not build the invoice PDF', error);
      setMessage({ id: invoice.id, text: 'The PDF could not be built. Try again.' });
    } finally {
      setBusy(null);
    }
  }

  async function duplicate(invoice: InvoiceRecord) {
    setBusy(invoice.id);
    setMessage(null);
    try {
      const stamp = now();
      const today = todayIso(stamp);
      const copy = duplicateInvoice(invoice, { id: newId(), number: await storage.invoices.nextNumber(today, seriesOf(invoice)), issueDate: today, now: stamp });
      const saved = await storage.invoices.save(copy);
      onEdit(saved.id);
    } catch (error) {
      console.error('Could not duplicate the invoice', error);
      setMessage({ id: invoice.id, text: 'The invoice could not be duplicated. Try again.' });
      setBusy(null);
    }
  }

  async function convert(invoice: InvoiceRecord) {
    setBusy(invoice.id);
    setMessage(null);
    try {
      const draft = await storage.invoices.convert(invoice.id, { id: newId(), issueDate: todayIso(now()) });
      onEdit(draft.id);
    } catch (error) {
      console.error('Could not convert the document', error);
      setMessage({ id: invoice.id, text: error instanceof ConversionError ? error.message : 'It could not be converted to an invoice. Try again.' });
      setBusy(null);
    }
  }

  async function confirm(invoice: InvoiceRecord, action: 'cancel' | 'delete') {
    setBusy(invoice.id);
    setMessage(null);
    try {
      if (action === 'cancel') await storage.invoices.cancel(invoice.id);
      else await storage.invoices.remove(invoice.id);
      setPending(null);
      await reload();
    } catch (error) {
      console.error('Could not change the invoice', error);
      setMessage({ id: invoice.id, text: 'That could not be done. Try again.' });
    } finally {
      setBusy(null);
    }
  }

  if (failed) {
    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <Notice tone="danger" title="Your invoices could not be opened">
          Your browser could not read what was saved on this device.
        </Notice>
        <div>
          <Button onClick={() => setAttempt((count) => count + 1)}>Try again</Button>
        </div>
      </div>
    );
  }
  if (invoices === null) return <p>Opening your invoices…</p>;

  if (invoices.length === 0) {
    return (
      <div className={styles.empty}>
        <h2 style={{ fontSize: '1.8rem' }}>Start your first document</h2>
        <p className={styles.lead}>Pick what you want to make. Each kind has its own numbers and its own use.</p>
        <KindCards gstStatus={profile?.gstStatus} onPick={onNew} label="Choose a document type to start with" />
        <p className={styles.hint}>
          The usual order is <strong>Quotation → Invoice</strong>: send a price offer, then turn it into an invoice once the client says yes. If the price is already agreed, start with an invoice.
        </p>
      </div>
    );
  }

  const counts: Record<Filter, number> = { all: invoices.length, invoice: 0, quote: 0, proforma: 0 };
  for (const invoice of invoices) counts[seriesOf(invoice)] += 1;
  const shown = filter === 'all' ? invoices : invoices.filter((invoice) => seriesOf(invoice) === filter);
  const byId = new Map(invoices.map((invoice) => [invoice.id, invoice]));

  function choose(kind: InvoiceKind) {
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
        <h2 style={{ fontSize: '1.8rem' }}>Documents</h2>
        <Button aria-expanded={choosing} aria-controls="new-document-chooser" onClick={() => setChoosing((open) => !open)}>
          <span aria-hidden="true">+</span> New
        </Button>
        {choosing ? (
          <div id="new-document-chooser" className={styles.chooser}>
            <KindCards gstStatus={profile?.gstStatus} onPick={choose} label="Choose a document type" autoFocus />
          </div>
        ) : null}
      </div>
      <div className={styles.segmented} role="group" aria-label="Filter by type">
        {FILTERS.map((option) => (
          <button key={option.value} type="button" className={styles.segment} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>
            {option.label}
            <span className={styles.count}>{counts[option.value]}</span>
          </button>
        ))}
      </div>
      {isBackupDue(lastBackupAt, now(), invoices.length > 0) ? (
        <div className={styles.reminder}>
          <Notice tone="warning" title="Back up your invoices">
            {lastBackupAt ? 'It has been a while since your last backup.' : 'You have not made a backup yet.'} Your invoices are stored only in this browser, so a backup file is your safety net.
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
      {shown.length === 0 && filter !== 'all' ? <p role="status">{EMPTY_TEXT[filter]}</p> : null}
      <ul className={styles.list} aria-label="Documents" role="list" ref={listRef}>
        {shown.map((invoice) => {
          const isPending = pending?.id === invoice.id;
          const kind = seriesOf(invoice);
          const isBusy = busy === invoice.id;
          const canConvert = kind !== 'invoice' && invoice.status === 'issued' && !invoice.convertedToId;
          const invoiced = invoice.convertedToId ? byId.get(invoice.convertedToId) : undefined;
          const open = (
            <Button key="open" variant="secondary" aria-label={`Open ${invoice.number}`} onClick={() => (invoice.status === 'draft' ? onEdit(invoice.id) : onView(invoice.id))}>
              Open
            </Button>
          );
          const pdf = (
            <Button key="pdf" variant="secondary" aria-label={`Download PDF ${invoice.number}`} disabled={isBusy} onClick={() => void download(invoice)}>
              {isBusy ? 'Preparing…' : 'Download PDF'}
            </Button>
          );
          // The main action depends on the kind and where the document is in its life; the rest follow in a fixed order.
          const primary = canConvert ? (
            <Button key="convert" aria-label={`${convertLabel(invoice)} ${invoice.number}`} disabled={isBusy} onClick={() => void convert(invoice)}>
              {convertLabel(invoice)}
            </Button>
          ) : invoice.convertedToId && invoiced ? (
            <Button key="invoiced" variant="secondary" aria-label={`Open invoice ${invoiced.number}`} onClick={() => (invoiced.status === 'draft' ? onEdit(invoiced.id) : onView(invoiced.id))}>
              Invoiced <span aria-hidden="true">→</span> {invoiced.number}
            </Button>
          ) : kind === 'invoice' && invoice.status === 'issued' ? (
            pdf
          ) : (
            open
          );
          return (
            <li key={invoice.id} className={`${kindClasses.scope} ${styles.item}`} data-kind={kind}>
              <div className={styles.top}>
                <span className={styles.ident}>
                  <KindBadge kind={invoice.kind} />
                  <span className={styles.number}>{invoice.number}</span>
                </span>
                <span className={styles.statuses}>
                  <StatusBadge status={invoice.status} />
                  <ConvertedBadge invoice={invoice} />
                </span>
              </div>
              <div className={styles.meta}>
                <span className={styles.client}>{invoice.client.name}</span>
                <span>{formatIsoDate(invoice.issueDate)}</span>
                <span className={styles.total}>{totalOf(invoice)}</span>
              </div>
              {isPending && pending ? (
                <div className={styles.confirm}>
                  <p ref={confirmRef} tabIndex={-1}>
                    {pending.action === 'cancel'
                      ? `Cancel ${kindNoun(invoice.kind)} ${invoice.number}? Its number stays used.`
                      : `Delete draft ${invoice.number}? This cannot be undone.`}
                  </p>
                  <div className={styles.actions}>
                    <Button disabled={isBusy} onClick={() => void confirm(invoice, pending.action)}>
                      {pending.action === 'cancel' ? `Yes, cancel ${kindNoun(invoice.kind)}` : 'Yes, delete draft'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        returnTo.current = `${pending.action === 'cancel' ? `Cancel ${kindNoun(invoice.kind)}` : 'Delete draft'} ${invoice.number}`;
                        setPending(null);
                      }}
                    >
                      Keep it
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={styles.actions}>
                  {primary}
                  {primary.key === 'open' ? null : open}
                  {primary.key === 'pdf' ? null : pdf}
                  <Button variant="ghost" aria-label={`Duplicate ${invoice.number}`} disabled={isBusy} onClick={() => void duplicate(invoice)}>
                    Duplicate
                  </Button>
                  {invoice.status === 'issued' ? (
                    <Button variant="ghost" aria-label={`Cancel ${kindNoun(invoice.kind)} ${invoice.number}`} onClick={() => setPending({ id: invoice.id, action: 'cancel' })}>
                      Cancel {kindNoun(invoice.kind)}
                    </Button>
                  ) : null}
                  {invoice.status === 'draft' ? (
                    <Button variant="ghost" aria-label={`Delete draft ${invoice.number}`} onClick={() => setPending({ id: invoice.id, action: 'delete' })}>
                      Delete draft
                    </Button>
                  ) : null}
                </div>
              )}
              {message?.id === invoice.id ? <Notice tone="danger">{message.text}</Notice> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
