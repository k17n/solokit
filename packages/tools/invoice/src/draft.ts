import { indianFiscalYear } from '@solokit/core';
import type { Client, InvoiceKind, InvoiceRecord, SellerProfile } from './model';
import { InvoiceLockedError } from './repositories';
import { resolveTheme, type InvoiceTheme } from './themes';
import { validateInvoice, type Issue } from './validation';

export interface DraftInput {
  id: string;
  number: string;
  issueDate: string;
  seller: SellerProfile;
  client: Client;
  /** Defaults to a tax invoice. */
  kind?: InvoiceKind;
  defaultThemeId?: string;
  now?: Date;
}

/** A new, empty domestic invoice. Seller and client are copied in as snapshots. */
export function createDraftInvoice(input: DraftInput): InvoiceRecord {
  const stamp = (input.now ?? new Date()).toISOString();
  const seller = structuredClone(input.seller);
  const client = structuredClone(input.client);
  const draft: InvoiceRecord = {
    id: input.id,
    number: input.number,
    fiscalYear: indianFiscalYear(input.issueDate),
    kind: input.kind ?? 'invoice',
    status: 'draft',
    issueDate: input.issueDate,
    seller,
    client,
    currency: 'INR',
    isExport: false,
    reverseCharge: false,
    exemptSupply: false,
    lines: [],
    themeId: input.defaultThemeId ?? 'classic',
    createdAt: stamp,
    updatedAt: stamp,
  };
  if (client.address.stateCode) draft.placeOfSupplyStateCode = client.address.stateCode;
  if (seller.defaultNotes) draft.notes = seller.defaultNotes;
  if (seller.defaultTerms) draft.terms = seller.defaultTerms;
  return draft;
}

export class InvoiceNotValidError extends Error {
  readonly issues: Issue[];
  constructor(issues: Issue[]) {
    super('This invoice has problems that need fixing before it can be issued');
    this.name = 'InvoiceNotValidError';
    this.issues = issues;
  }
}

/**
 * Turns a valid draft into an issued invoice. Returns a copy; the input is untouched. The invoice keeps a copy
 * of its theme (looked up among `customThemes`, or a preset), so editing or deleting the theme later never
 * changes how this invoice prints.
 */
export function issueInvoice(invoice: InvoiceRecord, customThemes: readonly InvoiceTheme[] = []): InvoiceRecord {
  if (invoice.status !== 'draft') throw new InvoiceLockedError();
  const issues = validateInvoice(invoice);
  if (issues.length > 0) throw new InvoiceNotValidError(issues);
  return { ...structuredClone(invoice), status: 'issued', themeSnapshot: structuredClone(resolveTheme(invoice.themeId, customThemes)) };
}
