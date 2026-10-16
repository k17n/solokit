import type { InvoiceKind } from './model';

/**
 * Fixed number prefixes for the documents that are not tax invoices. "QT/2026-27/0001" is 15 characters, inside
 * the 16-character GST limit; a seller's own prefix (up to 4 characters) would not fit in front of these.
 * Tax invoices keep the seller's own prefix.
 */
export const SERIES_PREFIX: Record<Exclude<InvoiceKind, 'invoice'>, string> = {
  proforma: 'PF/',
  quote: 'QT/',
};

/** The prefix a new number of this kind starts with. */
export function seriesPrefix(kind: InvoiceKind, sellerPrefix = ''): string {
  return kind === 'invoice' ? sellerPrefix : SERIES_PREFIX[kind];
}

/** Documents of different kinds are numbered separately, so the series is the kind. Old records without a kind are invoices. */
export const seriesOf = (record: { kind?: InvoiceKind | undefined }): InvoiceKind => record.kind ?? 'invoice';

/** Names for each kind, used in headings, buttons and file names. */
export const KIND_LABEL: Record<InvoiceKind, string> = {
  invoice: 'Invoice',
  proforma: 'Proforma invoice',
  quote: 'Quotation',
};
