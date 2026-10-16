import type { StoredRecord } from '@solokit/storage';
import type { SellerGstStatus } from '@solokit/tax-engines';

/** The business profile is one record in the `profile` collection of the current Business's database. */
export const PROFILE_ID = 'me';

/**
 * Version of the stored profile shape. 1: records saved before this field existed. 2: adds brand colours and where they
 * came from. `migrateProfile` upgrades older records when they are read.
 */
export const PROFILE_SCHEMA_VERSION = 2;

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

/** Brand colours as #RRGGBB. Every one is optional. */
export interface BrandColours {
  primary?: string;
  secondary?: string;
  text?: string;
  background?: string;
}

/** Where the brand colours came from: suggested from the logo, or typed in by the person. */
export type BrandSource = 'logo' | 'manual';

/**
 * The person or business behind a Business workspace. Saved once and reused by every tool (invoice, contract, ...).
 * Tools read only the fields they need; see `PROFILE_REQUIREMENTS`.
 */
export interface BusinessProfile extends StoredRecord {
  id: typeof PROFILE_ID;
  /** See {@link PROFILE_SCHEMA_VERSION}. Absent on records saved before it existed. */
  schemaVersion?: number;
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
  brand?: BrandColours;
  brandSource?: BrandSource;
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

export interface Issue {
  path: string;
  message: string;
}
