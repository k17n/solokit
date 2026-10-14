'use client';

import { useEffect, useMemo, useState } from 'react';
import { resolveTheme, type InvoiceRecord, type InvoiceStorage, type InvoiceTheme } from '@solokit/tool-invoice';
import { Button, Notice, formatIsoDate } from '@solokit/ui';
import { duplicateInvoice, todayIso } from './editorModel';
import { invoiceFileName } from './fileName';
import { newId } from './ids';
import { StatusBadge, totalOf } from './InvoiceList';
import { PdfPreview } from './PdfPreview';
import { defaultPdfRenderer, usePdfPreview, type PdfRenderer } from './usePdfPreview';

export interface InvoiceViewerProps {
  storage: InvoiceStorage;
  invoiceId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
  renderPdf?: PdfRenderer;
}

export function InvoiceViewer({ storage, invoiceId, onBack, onEdit, renderPdf = defaultPdfRenderer }: InvoiceViewerProps) {
  const [invoice, setInvoice] = useState<InvoiceRecord | null | undefined>(undefined);
  const [customThemes, setCustomThemes] = useState<InvoiceTheme[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([storage.invoices.get(invoiceId), storage.themes.list()])
      .then(([found, themes]) => {
        if (cancelled) return;
        setInvoice(found ?? null);
        setCustomThemes(themes);
      })
      .catch((failure: unknown) => {
        console.error('Could not open the invoice', failure);
        if (!cancelled) setInvoice(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storage, invoiceId]);

  const theme = useMemo(() => resolveTheme(invoice?.themeId ?? 'classic', customThemes), [invoice?.themeId, customThemes]);
  const preview = usePdfPreview({ invoice: invoice && invoice.status !== 'draft' ? invoice : null, theme, enabled: true, delayMs: 0, render: renderPdf });

  if (invoice === undefined) return <p>Opening the invoice…</p>;
  if (invoice === null) {
    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <Notice tone="danger" title="That invoice was not found">
          It may have been deleted. Go back to your invoices.
        </Notice>
        <div>
          <Button onClick={onBack}>Back to invoices</Button>
        </div>
      </div>
    );
  }
  if (invoice.status === 'draft') {
    return (
      <div style={{ display: 'grid', gap: '1rem', justifyItems: 'start' }}>
        <p>This invoice is a draft</p>
        <Button onClick={() => onEdit(invoice.id)}>Edit draft</Button>
      </div>
    );
  }

  const current = invoice;

  async function duplicate() {
    setBusy(true);
    setError(null);
    try {
      const today = todayIso(new Date());
      const copy = duplicateInvoice(current, { id: newId(), number: await storage.invoices.nextNumber(today), issueDate: today });
      const saved = await storage.invoices.save(copy);
      onEdit(saved.id);
    } catch (failure) {
      console.error('Could not duplicate the invoice', failure);
      setError('The invoice could not be duplicated. Try again.');
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      setInvoice(await storage.invoices.cancel(current.id));
      setConfirming(false);
    } catch (failure) {
      console.error('Could not cancel the invoice', failure);
      setError('The invoice could not be cancelled. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontFamily: 'var(--ff-mono)' }}>{current.number}</h2>
          <StatusBadge status={current.status} />
        </div>
        <Button variant="secondary" onClick={onBack}>
          Back to invoices
        </Button>
      </div>
      <p style={{ color: 'var(--text-muted)' }}>
        {current.client.name} · {formatIsoDate(current.issueDate)} · {totalOf(current)}
      </p>
      {confirming ? (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <p>Cancel this invoice? Its number stays used.</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button disabled={busy} onClick={() => void cancel()}>
              Yes, cancel invoice
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" disabled={busy} onClick={() => void duplicate()}>
            Duplicate as new draft
          </Button>
          {current.status === 'issued' ? (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Cancel invoice
            </Button>
          ) : null}
        </div>
      )}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <PdfPreview state={preview} filename={invoiceFileName(current)} onRetry={preview.retry} placeholder="Building the preview…" />
    </div>
  );
}
