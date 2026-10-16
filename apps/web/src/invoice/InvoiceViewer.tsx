'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ConversionError, resolveTheme, seriesOf, type InvoiceRecord, type InvoiceStorage, type InvoiceTheme } from '@solokit/tool-invoice';
import { Button, Notice, formatIsoDate } from '@solokit/ui';
import { duplicateInvoice, todayIso } from './editorModel';
import { invoiceFileName } from './fileName';
import { newId } from './ids';
import { ConvertedBadge, KindBadge, StatusBadge, kindNoun, totalOf } from './InvoiceList';
import { PdfPreview } from './PdfPreview';
import { defaultPdfRenderer, usePdfPreview, type PdfRenderer } from './usePdfPreview';

export interface InvoiceViewerProps {
  storage: InvoiceStorage;
  invoiceId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
  /** Opens another issued document, such as the quotation an invoice was made from. */
  onView?: (id: string) => void;
  renderPdf?: PdfRenderer;
  /** The current time. Tests pass a fixed one. */
  now?: () => Date;
}

const realNow = () => new Date();

export function InvoiceViewer({ storage, invoiceId, onBack, onEdit, onView, renderPdf = defaultPdfRenderer, now = realNow }: InvoiceViewerProps) {
  const [invoice, setInvoice] = useState<InvoiceRecord | null | undefined>(undefined);
  const [customThemes, setCustomThemes] = useState<InvoiceTheme[]>([]);
  /** The invoice made from this document, or the document this invoice was made from. */
  const [related, setRelated] = useState<InvoiceRecord | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const keptIt = useRef(false);

  // The confirm replaces the buttons: focus its question, and give focus back to the trigger when the user keeps the invoice.
  useEffect(() => {
    if (confirming) {
      confirmRef.current?.focus();
    } else if (keptIt.current) {
      keptIt.current = false;
      actionsRef.current?.querySelector<HTMLElement>('[data-cancel-trigger]')?.focus();
    }
  }, [confirming]);

  useEffect(() => {
    let cancelled = false;
    setRelated(null);
    Promise.all([storage.invoices.get(invoiceId), storage.themes.list()])
      .then(async ([found, themes]) => {
        const linkedId = found?.convertedToId ?? found?.convertedFromId;
        const linked = linkedId ? await storage.invoices.get(linkedId) : undefined;
        if (cancelled) return;
        setInvoice(found ?? null);
        setCustomThemes(themes);
        setRelated(linked ?? null);
      })
      .catch((failure: unknown) => {
        console.error('Could not open the invoice', failure);
        if (!cancelled) setInvoice(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storage, invoiceId]);

  const theme = useMemo(() => invoice?.themeSnapshot ?? resolveTheme(invoice?.themeId ?? 'classic', customThemes), [invoice?.themeSnapshot, invoice?.themeId, customThemes]);
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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button onClick={() => onEdit(invoice.id)}>Edit draft</Button>
          <Button variant="secondary" onClick={onBack}>
            Back to invoices
          </Button>
        </div>
      </div>
    );
  }

  const current = invoice;
  const noun = kindNoun(current.kind);
  const canConvert = current.kind !== undefined && current.kind !== 'invoice' && current.status === 'issued' && !current.convertedToId;

  async function duplicate() {
    setBusy(true);
    setError(null);
    try {
      const stamp = now();
      const today = todayIso(stamp);
      const copy = duplicateInvoice(current, { id: newId(), number: await storage.invoices.nextNumber(today, seriesOf(current)), issueDate: today, now: stamp });
      const saved = await storage.invoices.save(copy);
      onEdit(saved.id);
    } catch (failure) {
      console.error('Could not duplicate the invoice', failure);
      setError('The invoice could not be duplicated. Try again.');
      setBusy(false);
    }
  }

  async function convert() {
    setBusy(true);
    setError(null);
    try {
      const draft = await storage.invoices.convert(current.id, { id: newId(), issueDate: todayIso(now()) });
      onEdit(draft.id);
    } catch (failure) {
      console.error('Could not convert the document', failure);
      setError(failure instanceof ConversionError ? failure.message : 'It could not be converted to an invoice. Try again.');
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
          <KindBadge kind={current.kind} />
          <StatusBadge status={current.status} />
          <ConvertedBadge invoice={current} />
        </div>
        <Button variant="secondary" onClick={onBack}>
          Back to invoices
        </Button>
      </div>
      <p style={{ color: 'var(--text-muted)' }}>
        {current.client.name} · {formatIsoDate(current.issueDate)} · {totalOf(current)}
        {current.kind === 'quote' && current.validUntil ? ` · Valid until ${formatIsoDate(current.validUntil)}` : ''}
      </p>
      {related ? (
        <p style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          {current.convertedToId ? `Converted to ${related.status === 'draft' ? 'draft ' : ''}invoice ${related.number}.` : `Made from ${kindNoun(related.kind)} ${related.number}.`}
          <Button variant="ghost" aria-label={`Open ${related.number}`} onClick={() => (related.status === 'draft' ? onEdit(related.id) : onView?.(related.id))}>
            Open
          </Button>
        </p>
      ) : null}
      {confirming ? (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <p ref={confirmRef} tabIndex={-1}>
            Cancel this {noun}? Its number stays used.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button disabled={busy} onClick={() => void cancel()}>
              Yes, cancel {noun}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                keptIt.current = true;
                setConfirming(false);
              }}
            >
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div ref={actionsRef} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canConvert ? (
            <Button disabled={busy} onClick={() => void convert()}>
              Convert to invoice
            </Button>
          ) : null}
          <Button variant="secondary" disabled={busy} onClick={() => void duplicate()}>
            Duplicate as new draft
          </Button>
          {current.status === 'issued' ? (
            <Button variant="ghost" data-cancel-trigger="" onClick={() => setConfirming(true)}>
              Cancel {noun}
            </Button>
          ) : null}
        </div>
      )}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <PdfPreview state={preview} filename={invoiceFileName(current)} onRetry={preview.retry} placeholder="Building the preview…" />
    </div>
  );
}
