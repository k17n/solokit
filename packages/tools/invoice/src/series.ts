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

/**
 * The series a record's number belongs to. A proforma saved before proformas had their own "PF/" numbers holds an
 * ordinary tax-series number, so it keeps counting towards the tax invoices: a new tax invoice must never reuse a
 * number that is already printed on it.
 */
export function numberSeriesOf(record: { kind?: InvoiceKind | undefined; number: string }): InvoiceKind {
  const kind = seriesOf(record);
  if (kind === 'proforma' && !record.number.trim().toUpperCase().startsWith(SERIES_PREFIX.proforma)) return 'invoice';
  return kind;
}

/** Names for each kind, used in headings, buttons and file names. */
export const KIND_LABEL: Record<InvoiceKind, string> = {
  invoice: 'Invoice',
  proforma: 'Proforma invoice',
  quote: 'Quotation',
};

/** Whether a typed number looks like it belongs to this kind's series: "QT/" for quotations, "PF/" for proformas, anything else for tax invoices. */
export function numberFitsKind(number: string, kind: InvoiceKind): boolean {
  const text = number.trim().toUpperCase();
  const other = (Object.keys(SERIES_PREFIX) as (keyof typeof SERIES_PREFIX)[]).some((key) => text.startsWith(SERIES_PREFIX[key]));
  return kind === 'invoice' ? !other : text.startsWith(SERIES_PREFIX[kind]);
}
