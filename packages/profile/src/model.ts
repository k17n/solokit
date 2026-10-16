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
 * The custom invoice theme that was made from the brand colours, and what it looked like when SoloKit last wrote it. The
 * signature lets SoloKit tell a theme nobody has touched (safe to update when the logo changes) from one the person
 * edited (never overwritten).
 */
export interface BrandThemeLink {
  themeId: string;
  signature: string;
}

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
  /**
   * True when `gstStatus` is only a placeholder because the profile was started in a tool that does not ask about GST
   * (the contract tool). The invoice tool then still asks for the real status. Absent once the person has answered.
   */
  gstUnconfirmed?: boolean;
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
  /** The invoice theme made from the brand colours, if any. */
  brandTheme?: BrandThemeLink;
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
