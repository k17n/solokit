import { indianFiscalYear } from '@solokit/core';
import type { InvoiceRecord, SellerProfile } from './model';

export interface ConvertInput {
  id: string;
  /** The next number in the tax-invoice series. */
  number: string;
  issueDate: string;
  /** The seller as saved now. Falls back to the seller on the quote. */
  seller?: SellerProfile;
  now?: Date;
}

/**
 * A new draft tax invoice made from an issued quote or proforma. It keeps the client, lines, supply options,
 * notes, terms and theme. The validity date, due date, advance and the old number are not carried over, and
 * a quote's TDS and reverse charge (which a quote ignores) are not either. The source is left untouched.
 */
export function convertToInvoice(source: InvoiceRecord, input: ConvertInput): InvoiceRecord {
  const stamp = (input.now ?? new Date()).toISOString();
  const copy = structuredClone(source);
  delete copy.dueDate;
  delete copy.validUntil;
  delete copy.advanceReceived;
  delete copy.themeSnapshot;
  delete copy.convertedToId;
  if (source.kind === 'quote') {
    delete copy.tds;
    copy.reverseCharge = false;
  }
  return {
    ...copy,
    id: input.id,
    number: input.number,
    kind: 'invoice',
    status: 'draft',
    fiscalYear: indianFiscalYear(input.issueDate),
    issueDate: input.issueDate,
    seller: structuredClone(input.seller ?? source.seller),
    convertedFromId: source.id,
    createdAt: stamp,
    updatedAt: stamp,
  };
}
