import type { Minor } from '@solokit/core';
import type { StoredRecord } from '@solokit/storage';
import type { Address, BusinessProfile } from '@solokit/profile';
import type { Discount } from '@solokit/tax-engines';
import type { CurrencyCode } from './currencies';
import type { BillingUnit } from './units';
import type { InvoiceTheme } from './themes';

export const SETTINGS_ID = 'invoice';

export interface Client extends StoredRecord {
  name: string;
  gstin?: string;
  pan?: string;
  address: Address;
  email?: string;
  phone?: string;
}

export interface LineItem {
  id: string;
  description: string;
  /** HSN (goods) or SAC (services) code. */
  code?: string;
  quantity: number;
  unit: BillingUnit;
  /** Rate per unit, in minor units. */
  rate: Minor;
  discount?: Discount;
  /** GST rate in percent; ignored when no tax is charged. */
  gstRate?: number;
}

/**
 * What kind of document this is. Each kind has its own number series. A quote is an estimate, never a tax invoice,
 * and has a `validUntil` date instead of a due date.
 */
export type InvoiceKind = 'invoice' | 'proforma' | 'quote';
export type InvoiceStatus = 'draft' | 'issued' | 'cancelled';

export interface InvoiceRecord extends StoredRecord {
  number: string;
  fiscalYear: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  /** ISO dates, YYYY-MM-DD. */
  issueDate: string;
  dueDate?: string;
  /** Quotes only: the last day the quoted prices hold. */
  validUntil?: string;
  /** Snapshots taken when the invoice was saved, so later profile edits never change old invoices. */
  seller: BusinessProfile;
  client: Client;
  currency: CurrencyCode;
  isExport: boolean;
  placeOfSupplyStateCode?: string;
  reverseCharge: boolean;
  exemptSupply: boolean;
  lines: LineItem[];
  roundOff?: boolean;
  tds?: { ratePercent: number };
  advanceReceived?: Minor;
  notes?: string;
  terms?: string;
  /** Set on the invoice made from a quote or proforma: the id of the document it came from. */
  convertedFromId?: string;
  /** Set on a quote or proforma once it has been turned into an invoice: the id of that invoice. */
  convertedToId?: string;
  themeId: string;
  /** The theme as it was when the invoice was issued, so later theme edits or deletion never change an issued PDF. */
  themeSnapshot?: InvoiceTheme;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceSettings extends StoredRecord {
  id: typeof SETTINGS_ID;
  defaultThemeId: string;
  lastBackupAt?: string;
  onboarded: boolean;
}
