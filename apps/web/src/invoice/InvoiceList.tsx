'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  buildInvoiceDocument,
  resolveTheme,
  type InvoiceRecord,
  type InvoiceStorage,
  type InvoiceTheme,
} from '@solokit/tool-invoice';
import { Badge, Button, Notice, formatIsoDate } from '@solokit/ui';
import { downloadBlob } from './downloads';
import { duplicateInvoice, todayIso } from './editorModel';
import { newId } from './ids';
import { invoiceFileName } from './fileName';
import { defaultPdfRenderer, type PdfRenderer } from './usePdfPreview';
import styles from './InvoiceList.module.css';

export interface InvoiceListProps {
  storage: InvoiceStorage;
  onNew: () => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  renderPdf?: PdfRenderer;
}

type Pending = { id: string; action: 'cancel' | 'delete' } | null;

export function totalOf(invoice: InvoiceRecord): string {
  try {
    const rows = buildInvoiceDocument(invoice).totals;
    return rows.find((row) => row.emphasis === 'total')?.amount ?? '–';
  } catch {
    return '–';
  }
}

export function StatusBadge({ status }: { status: InvoiceRecord['status'] }) {
  if (status === 'issued') return <Badge tone="success">Issued</Badge>;
  if (status === 'cancelled') return <Badge tone="soon">Cancelled</Badge>;
  return <Badge>Draft</Badge>;
}

export function InvoiceList({ storage, onNew, onEdit, onView, renderPdf = defaultPdfRenderer }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<InvoiceRecord[] | null>(null);
  const [customThemes, setCustomThemes] = useState<InvoiceTheme[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string } | null>(null);

  const reload = useCallback(async () => {
    const [list, themes] = await Promise.all([storage.invoices.list(), storage.themes.list()]);
    setInvoices(list);
    setCustomThemes(themes);
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
      const blob = await renderPdf({ invoice, theme: resolveTheme(invoice.themeId, customThemes) });
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
      const today = todayIso(new Date());
      const copy = duplicateInvoice(invoice, { id: newId(), number: await storage.invoices.nextNumber(today), issueDate: today });
      const saved = await storage.invoices.save(copy);
      onEdit(saved.id);
    } catch (error) {
      console.error('Could not duplicate the invoice', error);
      setMessage({ id: invoice.id, text: 'The invoice could not be duplicated. Try again.' });
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
      <div style={{ display: 'grid', gap: '1rem', justifyItems: 'start' }}>
        <p>No invoices yet.</p>
        <Button onClick={onNew}>Create your first invoice</Button>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <h2 style={{ fontSize: '1.8rem' }}>Invoices</h2>
        <Button onClick={onNew}>New invoice</Button>
      </div>
      <ul className={styles.list} aria-label="Invoices" role="list">
        {invoices.map((invoice) => {
          const isPending = pending?.id === invoice.id;
          return (
            <li key={invoice.id} className={styles.item}>
              <div className={styles.top}>
                <span className={styles.number}>{invoice.number}</span>
                <StatusBadge status={invoice.status} />
              </div>
              <div className={styles.meta}>
                <span>{invoice.client.name}</span>
                <span>{formatIsoDate(invoice.issueDate)}</span>
                <span className={styles.total}>{totalOf(invoice)}</span>
              </div>
              {isPending && pending ? (
                <div className={styles.confirm}>
                  <p>
                    {pending.action === 'cancel'
                      ? `Cancel invoice ${invoice.number}? Its number stays used.`
                      : `Delete draft ${invoice.number}? This cannot be undone.`}
                  </p>
                  <div className={styles.actions}>
                    <Button disabled={busy === invoice.id} onClick={() => void confirm(invoice, pending.action)}>
                      {pending.action === 'cancel' ? 'Yes, cancel invoice' : 'Yes, delete draft'}
                    </Button>
                    <Button variant="secondary" onClick={() => setPending(null)}>
                      Keep it
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={styles.actions}>
                  <Button variant="secondary" aria-label={`Open ${invoice.number}`} onClick={() => (invoice.status === 'draft' ? onEdit(invoice.id) : onView(invoice.id))}>
                    Open
                  </Button>
                  <Button variant="secondary" aria-label={`Download PDF ${invoice.number}`} disabled={busy === invoice.id} onClick={() => void download(invoice)}>
                    {busy === invoice.id ? 'Preparing…' : 'Download PDF'}
                  </Button>
                  <Button variant="secondary" aria-label={`Duplicate ${invoice.number}`} disabled={busy === invoice.id} onClick={() => void duplicate(invoice)}>
                    Duplicate
                  </Button>
                  {invoice.status === 'issued' ? (
                    <Button variant="ghost" aria-label={`Cancel invoice ${invoice.number}`} onClick={() => setPending({ id: invoice.id, action: 'cancel' })}>
                      Cancel invoice
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
