'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { KIND_LABEL, type InvoiceKind, type SellerProfile } from '@solokit/tool-invoice';
import styles from './kinds.module.css';

/** The order kinds are offered in: bill, offer, ask for payment first. */
export const KIND_ORDER: readonly InvoiceKind[] = ['invoice', 'quote', 'proforma'];

const GLYPH: Record<InvoiceKind, string> = { invoice: 'INV', quote: 'QT', proforma: 'PF' };

/** One line on what each kind is for. */
export const KIND_USE: Record<InvoiceKind, string> = {
  invoice: 'Bill a client for work done',
  quote: 'Send a price offer before the work. Not a tax document',
  proforma: 'Ask for payment before you start or ship',
};

/**
 * What a document is called for this seller. An ordinary invoice is a Tax invoice for a regular GST seller,
 * a Bill of supply for a composition seller (or an exempt supply), and plain Invoice when not registered.
 */
export function documentName(kind: InvoiceKind, gstStatus?: SellerProfile['gstStatus'], exempt = false): string {
  if (kind === 'quote') return KIND_LABEL.quote;
  if (kind === 'proforma') return KIND_LABEL.proforma;
  if (gstStatus === undefined || gstStatus === 'unregistered') return 'Invoice';
  if (gstStatus === 'composition' || exempt) return 'Bill of supply';
  return 'Tax invoice';
}

/** The button that turns a quotation or proforma into an invoice: "Convert to invoice", or "Convert to tax invoice" for a proforma from a regular GST seller. */
export function convertLabel(record: { kind?: InvoiceKind | undefined; seller: Pick<SellerProfile, 'gstStatus'>; exemptSupply?: boolean }): string {
  if (record.kind !== 'proforma') return 'Convert to invoice';
  return `Convert to ${documentName('invoice', record.seller.gstStatus, record.exemptSupply).toLowerCase()}`;
}

/** A coloured code (INV, QT, PF) and the name of a document kind. The same colours mark the kind everywhere. */
export function KindBadge({ kind = 'invoice', label, large = false }: { kind: InvoiceKind | undefined; label?: string; large?: boolean }) {
  const shown = label ?? (kind === 'quote' ? 'Quotation' : kind === 'proforma' ? 'Proforma' : 'Invoice');
  return (
    <span className={`${styles.scope} ${styles.badge} ${large ? styles.large : ''}`} data-kind={kind}>
      <span className={styles.glyph} aria-hidden="true">
        {GLYPH[kind]}
      </span>
      <span className={styles.name}>{shown}</span>
    </span>
  );
}

/** Class names for containers that use a kind's colours; set `data-kind` beside `scope`. */
export const kindClasses = {
  scope: styles.scope,
  banner: styles.banner,
  bannerText: styles.bannerText,
  bannerActions: styles.bannerActions,
  textButton: styles.textButton,
} as const;

export interface KindCardsProps {
  gstStatus?: SellerProfile['gstStatus'] | undefined;
  /** The kind already chosen, which is marked and focused first. */
  current?: InvoiceKind | undefined;
  onPick: (kind: InvoiceKind) => void;
  label?: string;
  /** Moves focus into the cards when they appear. */
  autoFocus?: boolean;
}

/** Three cards, one per document kind, each a button with a short use-case line. Arrow keys move between them. */
export function KindCards({ gstStatus, current, onPick, label = 'Choose a document type', autoFocus = false }: KindCardsProps) {
  const group = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    const buttons = Array.from(group.current?.querySelectorAll<HTMLElement>('button') ?? []);
    (buttons[KIND_ORDER.indexOf(current ?? 'invoice')] ?? buttons[0])?.focus();
    // Only when the cards appear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const buttons = Array.from(group.current?.querySelectorAll<HTMLElement>('button') ?? []);
    const at = buttons.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    event.preventDefault();
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (at + (forward ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  return (
    <div className={styles.cards} role="group" aria-label={label} ref={group} onKeyDown={onKeyDown}>
      {KIND_ORDER.map((kind) => (
        <button
          key={kind}
          type="button"
          className={`${styles.scope} ${styles.card}`}
          data-kind={kind}
          aria-current={current === kind ? 'true' : undefined}
          aria-labelledby={`kind-name-${kind}`}
          aria-describedby={`kind-use-${kind}`}
          onClick={() => onPick(kind)}
        >
          <span className={styles.tile} aria-hidden="true">
            {GLYPH[kind]}
          </span>
          <span className={styles.cardTitle} id={`kind-name-${kind}`}>{documentName(kind, gstStatus)}</span>
          <span className={styles.cardUse} id={`kind-use-${kind}`}>
            {KIND_USE[kind]}
          </span>
        </button>
      ))}
    </div>
  );
}
