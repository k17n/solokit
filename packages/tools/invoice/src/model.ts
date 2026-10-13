import type { Minor } from '@solokit/core';
import type { StoredRecord } from '@solokit/storage';
import type { Discount, SellerGstStatus } from '@solokit/tax-engines';
import type { CurrencyCode } from './currencies';
import type { BillingUnit } from './units';

export const SELLER_ID = 'me';
export const SETTINGS_ID = 'invoice';

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  postalCode?: string;
  /** GST state code for Indian addresses (for example "27"). */
  stateCode?: string;
  country: string;
}

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  branch?: string;
}

/** The person or business issuing invoices. Saved once and reused. */
export interface SellerProfile extends StoredRecord {
  id: typeof SELLER_ID;
  name: string;
  gstStatus: SellerGstStatus;
  gstin?: string;
  pan?: string;
  udyam?: string;
  address: Address;
  email?: string;
  phone?: string;
  website?: string;
  /** Logo as a data URL, so it travels inside the JSON backup. */
  logoDataUrl?: string;
  bank?: BankDetails;
  upiId?: string;
  lutNumber?: string;
  /** Prefix for invoice numbers, for example "INV/". */
  invoicePrefix?: string;
  defaultNotes?: string;
  defaultTerms?: string;
  /** Unregistered sellers: print "Not registered under GST". Defaults to true. */
  unregisteredNote?: boolean;
}

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

export type InvoiceKind = 'invoice' | 'proforma';
export type InvoiceStatus = 'draft' | 'issued';

export interface InvoiceRecord extends StoredRecord {
  number: string;
  fiscalYear: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  /** ISO dates, YYYY-MM-DD. */
  issueDate: string;
  dueDate?: string;
  /** Snapshots taken when the invoice was saved, so later profile edits never change old invoices. */
  seller: SellerProfile;
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
  themeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceSettings extends StoredRecord {
  id: typeof SETTINGS_ID;
  defaultThemeId: string;
  lastBackupAt?: string;
  onboarded: boolean;
}
