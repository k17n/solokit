# Invoice Domain Implementation Plan (Plan 3A of 3C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, fully unit-tested and with no UI, everything the invoice tool needs to know and remember: the data model, validation, the invoice document view-model (all GST, TDS, export and reverse-charge presentation rules), UPI payment links, SAC code search, themes, saved-data repositories, and JSON backup/restore.

**Architecture:** One new workspace package `packages/tools/invoice` (`@solokit/tool-invoice`) of pure TypeScript. It depends on `@solokit/core` (money, amount in words, numbering), `@solokit/tax-engines` (GST engine, GSTIN) and `@solokit/storage` (`DataStore`). `buildInvoiceDocument` turns a saved invoice record into a fully formatted view-model so the PDF and screen layers (Plans 3B and 3C) stay dumb. Invoices store snapshots of the seller and client so old invoices never change when a profile is edited.

**Tech Stack:** TypeScript (strict), Vitest, in-memory `DataStore` for tests.

## Plan roadmap

1. Plan 3A (this plan): invoice domain, themes, repositories, backup.
2. Plan 3B: PDF engine: fonts subsetted at dev time (Inter, Poppins, Source Serif 4, IBM Plex Mono, Geist Mono), `@react-pdf/renderer` documents for the 6 theme presets, logo and QR handling in PDFs.
3. Plan 3C: the screens: onboarding, seller profile, invoice editor, live preview, theme and logo editor, saved invoices, backup UI, registry flip to "available".

## Global Constraints

From the spec and earlier plans; every task's requirements include them.

- Money is **integer paise** (`Minor`); never floats.
- Seller types: **Regular GST** (Tax Invoice; CGST+SGST or IGST), **Composition** (Bill of Supply, no tax), **Unregistered** (plain Invoice, no tax, no GSTIN), registered sellers of **exempt supplies** (Bill of Supply). A **proforma** flag overrides the title.
- Document titles: "Tax Invoice", "Bill of Supply", "Invoice", "Proforma Invoice".
- Composition declaration must read: "Composition taxable person, not eligible to collect tax on supplies."
- Export of services is **zero-rated under LUT**; the invoice shows the LUT number when the seller has one. Export totals are **not** rounded to the whole currency unit by default (the engine default).
- **TDS** is a user-entered percentage on the value excluding GST; the document shows TDS and a "Net payable" line. **Advance received** is also subtracted for the net payable.
- Invoice numbers are financial-year series within **16 characters** (letters, digits, `/`, `-`).
- Supported invoice currencies (amount-in-words support and glyph coverage in the bundled fonts): **INR, USD, EUR, GBP**.
- Invoice fonts (used from Plan 3B): Inter, Poppins (sans); Source Serif 4 (serif); IBM Plex Mono, Geist Mono (mono). Every one contains ₹, €, £ and $ (verified).
- Theme customisation is **colours plus a font choice** only; layout is fixed per preset. Presets: classic, modern, minimal, bold, consultant, formal. Text/background contrast must be at least 4.5:1.
- Tax rules and thresholds are data with an "as of" date and are not tax advice.
- Storage goes through `DataStore` (collections `profile`, `clients`, `invoices`, `themes`, `settings`).

## File Structure

```
packages/tools/invoice/
  package.json  tsconfig.json
  src/
    index.ts
    currencies.ts   currencies.test.ts
    units.ts        units.test.ts
    model.ts
    testing.ts                      (shared test fixtures; not exported from index)
    validation.ts   validation.test.ts
    upi.ts          upi.test.ts
    declarations.ts declarations.test.ts
    document.ts     document.test.ts
    codes.ts        codes.test.ts
    themes.ts       themes.test.ts
    repositories.ts repositories.test.ts
    backup.ts       backup.test.ts
```

---

### Task 1: Package scaffold, currencies, billing units and the data model

**Files:**
- Create: `packages/tools/invoice/package.json`, `tsconfig.json`
- Create: `src/currencies.ts`, `src/units.ts`, `src/model.ts`, `src/testing.ts`, `src/index.ts`
- Test: `src/currencies.test.ts`, `src/units.test.ts`

**Interfaces:**
- Produces (`@solokit/tool-invoice`):
  - `SUPPORTED_CURRENCIES` (code, name, symbol, locale), `type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP'`, `isCurrencyCode(value: string): value is CurrencyCode`, `localeForCurrency(code): string`, `formatAmount(minor: Minor, code: CurrencyCode): string`
  - `BILLING_UNITS`, `type BillingUnit`, `BILLING_UNIT_LABELS`, `formatQuantity(quantity: number, unit: BillingUnit): string`
  - Model types: `Address`, `BankDetails`, `SellerProfile`, `Client`, `LineItem`, `InvoiceKind`, `InvoiceStatus`, `InvoiceRecord`, `InvoiceSettings`, constants `SELLER_ID = 'me'`, `SETTINGS_ID = 'invoice'`
  - Test fixtures (`src/testing.ts`, not exported from the index): `makeSeller`, `makeClient`, `makeInvoice`

- [ ] **Step 1: Create the package files**

`packages/tools/invoice/package.json`:
```json
{
  "name": "@solokit/tool-invoice",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@solokit/core": "workspace:*",
    "@solokit/storage": "workspace:*",
    "@solokit/tax-engines": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/tools/invoice/tsconfig.json`:
```json
{
  "extends": "../../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing tests**

`packages/tools/invoice/src/currencies.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SUPPORTED_CURRENCIES, formatAmount, isCurrencyCode, localeForCurrency } from './currencies';

describe('currencies', () => {
  it('supports INR, USD, EUR and GBP', () => {
    expect(SUPPORTED_CURRENCIES.map((currency) => currency.code)).toEqual(['INR', 'USD', 'EUR', 'GBP']);
  });

  it('recognises supported codes only', () => {
    expect(isCurrencyCode('INR')).toBe(true);
    expect(isCurrencyCode('JPY')).toBe(false);
    expect(isCurrencyCode('inr')).toBe(false);
  });

  it('picks a sensible locale per currency', () => {
    expect(localeForCurrency('INR')).toBe('en-IN');
    expect(localeForCurrency('USD')).toBe('en-US');
  });

  it('formats amounts with the right symbol and grouping', () => {
    expect(formatAmount(12345600, 'INR')).toBe('₹1,23,456.00');
    expect(formatAmount(123456, 'USD')).toBe('$1,234.56');
    expect(formatAmount(123456, 'EUR')).toBe('€1,234.56');
    expect(formatAmount(123456, 'GBP')).toBe('£1,234.56');
    expect(formatAmount(-5000, 'INR')).toBe('-₹50.00');
  });
});
```

`packages/tools/invoice/src/units.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BILLING_UNITS, BILLING_UNIT_LABELS, formatQuantity } from './units';

describe('billing units', () => {
  it('has a label for every unit', () => {
    for (const unit of BILLING_UNITS) expect(BILLING_UNIT_LABELS[unit]).toBeTruthy();
  });

  it('formats hours, days and months with correct singular and plural', () => {
    expect(formatQuantity(24, 'hours')).toBe('24 hrs');
    expect(formatQuantity(1, 'hours')).toBe('1 hr');
    expect(formatQuantity(7.5, 'hours')).toBe('7.5 hrs');
    expect(formatQuantity(3, 'days')).toBe('3 days');
    expect(formatQuantity(1, 'days')).toBe('1 day');
    expect(formatQuantity(2, 'months')).toBe('2 months');
    expect(formatQuantity(1, 'months')).toBe('1 month');
  });

  it('formats items as a bare number and trims trailing zeros', () => {
    expect(formatQuantity(5, 'items')).toBe('5');
    expect(formatQuantity(2.5, 'items')).toBe('2.5');
    expect(formatQuantity(1.2346, 'items')).toBe('1.235');
  });

  it('formats fixed fees and retainers', () => {
    expect(formatQuantity(1, 'fixed')).toBe('Fixed fee');
    expect(formatQuantity(2, 'fixed')).toBe('2 × fixed fee');
    expect(formatQuantity(1, 'retainer')).toBe('Retainer');
    expect(formatQuantity(3, 'retainer')).toBe('3 × retainer');
  });
});
```

- [ ] **Step 3: Install and run to verify failure**

Run: `pnpm install`
Then: `pnpm --filter @solokit/tool-invoice test`
Expected: FAIL (cannot resolve `./currencies` and `./units`).

- [ ] **Step 4: Implement currencies and units**

`packages/tools/invoice/src/currencies.ts`:
```ts
import { formatMoney, type Minor } from '@solokit/core';

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', name: 'Indian rupee', symbol: '₹', locale: 'en-IN' },
  { code: 'USD', name: 'US dollar', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'en-IE' },
  { code: 'GBP', name: 'Pound sterling', symbol: '£', locale: 'en-GB' },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code'];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return SUPPORTED_CURRENCIES.some((currency) => currency.code === value);
}

export function localeForCurrency(code: CurrencyCode): string {
  const found = SUPPORTED_CURRENCIES.find((currency) => currency.code === code);
  return found ? found.locale : 'en-US';
}

export function formatAmount(minor: Minor, code: CurrencyCode): string {
  return formatMoney(minor, code, localeForCurrency(code));
}
```

`packages/tools/invoice/src/units.ts`:
```ts
export const BILLING_UNITS = ['hours', 'days', 'months', 'items', 'fixed', 'retainer'] as const;
export type BillingUnit = (typeof BILLING_UNITS)[number];

export const BILLING_UNIT_LABELS: Record<BillingUnit, string> = {
  hours: 'Hours',
  days: 'Days',
  months: 'Months',
  items: 'Items',
  fixed: 'Fixed fee',
  retainer: 'Retainer',
};

/** Up to three decimals, trailing zeros trimmed: 7.5, 24, 1.235. */
function trimmed(quantity: number): string {
  return Number(quantity.toFixed(3)).toString();
}

function counted(quantity: number, singular: string, plural: string): string {
  return `${trimmed(quantity)} ${quantity === 1 ? singular : plural}`;
}

/** How a quantity reads on an invoice line: "24 hrs", "3 days", "Fixed fee". */
export function formatQuantity(quantity: number, unit: BillingUnit): string {
  switch (unit) {
    case 'hours':
      return counted(quantity, 'hr', 'hrs');
    case 'days':
      return counted(quantity, 'day', 'days');
    case 'months':
      return counted(quantity, 'month', 'months');
    case 'items':
      return trimmed(quantity);
    case 'fixed':
      return quantity === 1 ? 'Fixed fee' : `${trimmed(quantity)} × fixed fee`;
    case 'retainer':
      return quantity === 1 ? 'Retainer' : `${trimmed(quantity)} × retainer`;
  }
}
```

- [ ] **Step 5: Write the model, the fixtures and the index**

`packages/tools/invoice/src/model.ts`:
```ts
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
```

`packages/tools/invoice/src/testing.ts`:
```ts
import type { Client, InvoiceRecord, SellerProfile } from './model';

// Valid GSTINs (checksums verified): Maharashtra 27AAPFU0939F1ZV, 27AABCT3518Q1ZW; Karnataka 29AAGCB7383J1Z4.

export function makeSeller(overrides: Partial<SellerProfile> = {}): SellerProfile {
  return {
    id: 'me',
    name: 'Asha Rao Consulting',
    gstStatus: 'regular',
    gstin: '27AAPFU0939F1ZV',
    pan: 'AAPFU0939F',
    address: { line1: '12 Linking Road', city: 'Mumbai', postalCode: '400050', stateCode: '27', country: 'India' },
    email: 'asha@example.com',
    upiId: 'asha@okhdfc',
    bank: {
      accountName: 'Asha Rao Consulting',
      accountNumber: '123456789012',
      ifsc: 'HDFC0001234',
      bankName: 'HDFC Bank',
      branch: 'Bandra West',
    },
    invoicePrefix: '',
    ...overrides,
  };
}

export function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    name: 'Northwind Traders',
    gstin: '27AABCT3518Q1ZW',
    address: { line1: '4 MG Road', city: 'Pune', postalCode: '411001', stateCode: '27', country: 'India' },
    email: 'accounts@northwind.example',
    ...overrides,
  };
}

/** One line: 24 hours at Rs 3,000 with 18% GST, Maharashtra to Maharashtra, issued 2026-10-14. */
export function makeInvoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: 'inv-1',
    number: '2026-27/0001',
    fiscalYear: '2026-27',
    kind: 'invoice',
    status: 'issued',
    issueDate: '2026-10-14',
    seller: makeSeller(),
    client: makeClient(),
    currency: 'INR',
    isExport: false,
    placeOfSupplyStateCode: '27',
    reverseCharge: false,
    exemptSupply: false,
    lines: [
      { id: 'l1', description: 'Consulting', code: '998312', quantity: 24, unit: 'hours', rate: 300000, gstRate: 18 },
    ],
    themeId: 'classic',
    createdAt: '2026-10-14T09:00:00.000Z',
    updatedAt: '2026-10-14T09:00:00.000Z',
    ...overrides,
  };
}
```

`packages/tools/invoice/src/index.ts`:
```ts
export * from './currencies';
export * from './units';
export * from './model';
```

- [ ] **Step 6: Run tests and typecheck**

Run: `pnpm --filter @solokit/tool-invoice test`
Expected: PASS (currencies 4, units 4).
Run: `pnpm --filter @solokit/tool-invoice typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(invoice): scaffold package with currencies, billing units and data model

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Validation

**Files:**
- Create: `packages/tools/invoice/src/validation.ts`
- Modify: `src/index.ts`
- Test: `src/validation.test.ts`

**Interfaces:**
- Consumes: `validateGstin`, `isValidStateCode`, `isAllowedGstRate` from `@solokit/tax-engines`; `formatInvoiceNumber` from `@solokit/core`; model types; `isCurrencyCode`.
- Produces:
  - `interface Issue { path: string; message: string }`
  - `isRealIsoDate(value: string): boolean`
  - `validateSeller(seller: SellerProfile): Issue[]`
  - `validateClient(client: Client): Issue[]`
  - `validateInvoice(invoice: InvoiceRecord): Issue[]` (seller and client issues are prefixed `seller.` and `client.`)
  - Validation is strict about format only; callers normalise input (for example upper-case GSTIN/PAN) before validating.

- [ ] **Step 1: Write the failing tests**

`packages/tools/invoice/src/validation.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { makeClient, makeInvoice, makeSeller } from './testing';
import { isRealIsoDate, validateClient, validateInvoice, validateSeller } from './validation';

const paths = (issues: { path: string }[]) => issues.map((issue) => issue.path);

describe('isRealIsoDate', () => {
  it('accepts real calendar dates only', () => {
    expect(isRealIsoDate('2026-10-14')).toBe(true);
    expect(isRealIsoDate('2028-02-29')).toBe(true);
    expect(isRealIsoDate('2026-02-29')).toBe(false);
    expect(isRealIsoDate('2026-13-01')).toBe(false);
    expect(isRealIsoDate('14/10/2026')).toBe(false);
    expect(isRealIsoDate('')).toBe(false);
  });
});

describe('validateSeller', () => {
  it('accepts a complete regular seller', () => {
    expect(validateSeller(makeSeller())).toEqual([]);
  });

  it('requires a name and the first address line and city', () => {
    const seller = makeSeller({ name: ' ', address: { line1: '', city: '', country: 'India', stateCode: '27' } });
    expect(paths(validateSeller(seller))).toEqual(expect.arrayContaining(['name', 'address.line1', 'address.city']));
  });

  it('requires a valid GSTIN for regular and composition sellers', () => {
    expect(paths(validateSeller(makeSeller({ gstin: undefined })))).toContain('gstin');
    expect(paths(validateSeller(makeSeller({ gstin: '27AAPFU0939F1ZX' })))).toContain('gstin');
    expect(paths(validateSeller(makeSeller({ gstStatus: 'composition', gstin: undefined })))).toContain('gstin');
    expect(validateSeller(makeSeller({ gstStatus: 'composition' }))).toEqual([]);
  });

  it('requires the address state to match the GSTIN state', () => {
    const seller = makeSeller({ address: { line1: 'x', city: 'Bengaluru', stateCode: '29', country: 'India' } });
    expect(paths(validateSeller(seller))).toContain('address.stateCode');
    const missing = makeSeller({ address: { line1: 'x', city: 'Pune', country: 'India' } });
    expect(paths(validateSeller(missing))).toContain('address.stateCode');
  });

  it('does not allow a GSTIN for an unregistered seller', () => {
    const seller = makeSeller({ gstStatus: 'unregistered' });
    expect(paths(validateSeller(seller))).toContain('gstin');
    expect(validateSeller(makeSeller({ gstStatus: 'unregistered', gstin: undefined }))).toEqual([]);
  });

  it('checks the formats of the optional fields', () => {
    const seller = makeSeller({
      pan: 'abc',
      email: 'not-an-email',
      upiId: 'no-at-sign',
      udyam: 'UDYAM-1',
      invoicePrefix: 'TOO-LONG/',
      bank: { accountName: 'A', accountNumber: '12', ifsc: 'BAD', bankName: 'B' },
    });
    expect(paths(validateSeller(seller))).toEqual(
      expect.arrayContaining(['pan', 'email', 'upiId', 'udyam', 'invoicePrefix', 'bank.accountNumber', 'bank.ifsc']),
    );
  });

  it('accepts a valid UDYAM number and UPI id', () => {
    expect(validateSeller(makeSeller({ udyam: 'UDYAM-MH-19-0012345', upiId: 'asha.rao@okicici' }))).toEqual([]);
  });
});

describe('validateClient', () => {
  it('accepts a complete client', () => {
    expect(validateClient(makeClient())).toEqual([]);
  });

  it('requires a name and a country, and validates optional fields', () => {
    const client = makeClient({ name: '', gstin: '27AAPFU0939F1ZX', pan: 'x', email: 'bad', address: { line1: 'a', city: 'b', country: '' } });
    expect(paths(validateClient(client))).toEqual(expect.arrayContaining(['name', 'address.country', 'gstin', 'pan', 'email']));
  });

  it('allows a foreign client without a GSTIN or state', () => {
    const client = makeClient({ gstin: undefined, address: { line1: '1 Main St', city: 'Austin', country: 'United States' } });
    expect(validateClient(client)).toEqual([]);
  });
});

describe('validateInvoice', () => {
  it('accepts a complete invoice', () => {
    expect(validateInvoice(makeInvoice())).toEqual([]);
  });

  it('checks the number and the dates', () => {
    expect(paths(validateInvoice(makeInvoice({ number: 'has spaces' })))).toContain('number');
    expect(paths(validateInvoice(makeInvoice({ number: '2026-27/0000000001' })))).toContain('number');
    expect(paths(validateInvoice(makeInvoice({ issueDate: '2026-02-30' })))).toContain('issueDate');
    expect(paths(validateInvoice(makeInvoice({ dueDate: '2026-10-01' })))).toContain('dueDate');
    expect(validateInvoice(makeInvoice({ dueDate: '2026-10-14' }))).toEqual([]);
  });

  it('prefixes seller and client problems', () => {
    const invoice = makeInvoice({ seller: makeSeller({ name: '' }), client: makeClient({ name: '' }) });
    expect(paths(validateInvoice(invoice))).toEqual(expect.arrayContaining(['seller.name', 'client.name']));
  });

  it('needs at least one line, and checks every line', () => {
    expect(paths(validateInvoice(makeInvoice({ lines: [] })))).toContain('lines');
    const bad = makeInvoice({
      lines: [{ id: 'a', description: ' ', quantity: 0, unit: 'hours', rate: 10.5, gstRate: 7 }],
    });
    expect(paths(validateInvoice(bad))).toEqual(
      expect.arrayContaining(['lines[0].description', 'lines[0].quantity', 'lines[0].rate', 'lines[0].gstRate']),
    );
  });

  it('checks discounts', () => {
    const bad = makeInvoice({
      lines: [{ id: 'a', description: 'x', quantity: 1, unit: 'items', rate: 1000, gstRate: 18, discount: { kind: 'percent', percent: 150 } }],
    });
    expect(paths(validateInvoice(bad))).toContain('lines[0].discount');
  });

  it('requires a place of supply only for taxed domestic supplies', () => {
    expect(paths(validateInvoice(makeInvoice({ placeOfSupplyStateCode: undefined })))).toContain('placeOfSupplyStateCode');
    expect(paths(validateInvoice(makeInvoice({ placeOfSupplyStateCode: '00' })))).toContain('placeOfSupplyStateCode');
    expect(validateInvoice(makeInvoice({ placeOfSupplyStateCode: undefined, isExport: true }))).toEqual([]);
    const unregistered = makeInvoice({
      seller: makeSeller({ gstStatus: 'unregistered', gstin: undefined }),
      placeOfSupplyStateCode: undefined,
      lines: [{ id: 'a', description: 'x', quantity: 1, unit: 'items', rate: 1000 }],
    });
    expect(validateInvoice(unregistered)).toEqual([]);
  });

  it('checks TDS, the advance and the currency', () => {
    expect(paths(validateInvoice(makeInvoice({ tds: { ratePercent: 120 } })))).toContain('tds.ratePercent');
    expect(paths(validateInvoice(makeInvoice({ advanceReceived: -1 })))).toContain('advanceReceived');
    expect(paths(validateInvoice(makeInvoice({ currency: 'JPY' as never })))).toContain('currency');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tool-invoice test -- validation`
Expected: FAIL (cannot resolve `./validation`).

- [ ] **Step 3: Implement**

`packages/tools/invoice/src/validation.ts`:
```ts
import { InvoiceNumberError, formatInvoiceNumber } from '@solokit/core';
import { isAllowedGstRate, isValidStateCode, validateGstin } from '@solokit/tax-engines';
import { isCurrencyCode } from './currencies';
import type { Client, InvoiceRecord, SellerProfile } from './model';

export interface Issue {
  path: string;
  message: string;
}

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER = /^\d{9,18}$/;
const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
const UDYAM = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVOICE_NUMBER = /^[A-Za-z0-9/-]{1,16}$/;

export function isRealIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const blank = (value: string | undefined) => value === undefined || value.trim() === '';

export function validateSeller(seller: SellerProfile): Issue[] {
  const issues: Issue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  if (blank(seller.name)) add('name', 'Enter your name or business name');
  if (blank(seller.address.line1)) add('address.line1', 'Enter the first line of your address');
  if (blank(seller.address.city)) add('address.city', 'Enter your city');

  if (seller.gstStatus === 'unregistered') {
    if (!blank(seller.gstin)) {
      add('gstin', 'Remove the GSTIN, or choose Regular or Composition as your GST status');
    }
  } else if (blank(seller.gstin)) {
    add('gstin', 'Enter your GSTIN');
  } else {
    const result = validateGstin(seller.gstin ?? '');
    if (!result.valid) {
      add('gstin', result.reason);
    } else if (seller.address.stateCode !== result.stateCode) {
      add('address.stateCode', 'The state must match the first two digits of your GSTIN');
    }
  }

  if (seller.gstStatus !== 'unregistered' && blank(seller.address.stateCode)) {
    if (!issues.some((issue) => issue.path === 'address.stateCode')) add('address.stateCode', 'Choose your state');
  }

  if (!blank(seller.pan) && !PAN.test(seller.pan ?? '')) add('pan', 'PAN looks like ABCDE1234F');
  if (!blank(seller.udyam) && !UDYAM.test(seller.udyam ?? '')) add('udyam', 'UDYAM number looks like UDYAM-MH-19-0012345');
  if (!blank(seller.email) && !EMAIL.test(seller.email ?? '')) add('email', 'Enter a valid email address');
  if (!blank(seller.upiId) && !UPI_ID.test(seller.upiId ?? '')) add('upiId', 'UPI ID looks like name@bank');

  if (seller.invoicePrefix) {
    try {
      formatInvoiceNumber({ prefix: seller.invoicePrefix, fiscalYear: '2026-27', sequence: 1 });
    } catch (error) {
      if (!(error instanceof InvoiceNumberError)) throw error;
      add('invoicePrefix', 'Use at most 4 letters, digits, "/" or "-" so the number stays within 16 characters');
    }
  }

  if (seller.bank) {
    if (!ACCOUNT_NUMBER.test(seller.bank.accountNumber)) add('bank.accountNumber', 'Account number has 9 to 18 digits');
    if (!IFSC.test(seller.bank.ifsc)) add('bank.ifsc', 'IFSC looks like HDFC0001234');
  }
  return issues;
}

export function validateClient(client: Client): Issue[] {
  const issues: Issue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  if (blank(client.name)) add('name', 'Enter the client name');
  if (blank(client.address.country)) add('address.country', 'Enter the client country');
  if (!blank(client.gstin)) {
    const result = validateGstin(client.gstin ?? '');
    if (!result.valid) add('gstin', result.reason);
  }
  if (!blank(client.pan) && !PAN.test(client.pan ?? '')) add('pan', 'PAN looks like ABCDE1234F');
  if (!blank(client.email) && !EMAIL.test(client.email ?? '')) add('email', 'Enter a valid email address');
  return issues;
}

export function validateInvoice(invoice: InvoiceRecord): Issue[] {
  const issues: Issue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  if (!INVOICE_NUMBER.test(invoice.number)) {
    add('number', 'Invoice numbers use up to 16 letters, digits, "/" or "-"');
  }
  if (!isRealIsoDate(invoice.issueDate)) add('issueDate', 'Enter a valid issue date');
  if (invoice.dueDate !== undefined) {
    if (!isRealIsoDate(invoice.dueDate)) add('dueDate', 'Enter a valid due date');
    else if (isRealIsoDate(invoice.issueDate) && invoice.dueDate < invoice.issueDate) {
      add('dueDate', 'The due date cannot be before the issue date');
    }
  }
  if (!isCurrencyCode(invoice.currency)) add('currency', 'Choose a supported currency');

  for (const issue of validateSeller(invoice.seller)) add(`seller.${issue.path}`, issue.message);
  for (const issue of validateClient(invoice.client)) add(`client.${issue.path}`, issue.message);

  const taxed = invoice.seller.gstStatus === 'regular' && !invoice.isExport && !invoice.exemptSupply;
  if (taxed && (!invoice.placeOfSupplyStateCode || !isValidStateCode(invoice.placeOfSupplyStateCode))) {
    add('placeOfSupplyStateCode', 'Choose the place of supply');
  }

  if (invoice.lines.length === 0) add('lines', 'Add at least one line item');
  invoice.lines.forEach((line, index) => {
    const at = `lines[${index}]`;
    if (blank(line.description)) add(`${at}.description`, 'Describe what you are charging for');
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) add(`${at}.quantity`, 'Quantity must be more than 0');
    if (!Number.isSafeInteger(line.rate) || line.rate < 0) add(`${at}.rate`, 'Enter the rate as an amount of 0 or more');
    if (taxed && line.gstRate !== undefined && !isAllowedGstRate(line.gstRate)) {
      add(`${at}.gstRate`, `${line.gstRate}% is not a GST rate`);
    }
    if (line.discount) {
      const bad =
        line.discount.kind === 'percent'
          ? !Number.isFinite(line.discount.percent) || line.discount.percent < 0 || line.discount.percent > 100
          : !Number.isSafeInteger(line.discount.amount) || line.discount.amount < 0;
      if (bad) add(`${at}.discount`, 'Enter a discount between 0 and the line amount');
    }
  });

  if (invoice.tds && (!Number.isFinite(invoice.tds.ratePercent) || invoice.tds.ratePercent < 0 || invoice.tds.ratePercent > 100)) {
    add('tds.ratePercent', 'TDS rate must be between 0 and 100');
  }
  if (invoice.advanceReceived !== undefined && (!Number.isSafeInteger(invoice.advanceReceived) || invoice.advanceReceived < 0)) {
    add('advanceReceived', 'Advance must be 0 or more');
  }
  return issues;
}
```

- [ ] **Step 4: Export, run tests and typecheck**

Append to `packages/tools/invoice/src/index.ts`:
```ts
export * from './validation';
```
Run: `pnpm --filter @solokit/tool-invoice test`
Expected: PASS.
Run: `pnpm --filter @solokit/tool-invoice typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(invoice): add seller, client and invoice validation

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: UPI payment links

**Files:**
- Create: `packages/tools/invoice/src/upi.ts`
- Modify: `src/index.ts`
- Test: `src/upi.test.ts`

**Interfaces:**
- Produces: `buildUpiPayload(input: { upiId: string; payeeName: string; amountMinor: Minor; note?: string }): string`. Throws `RangeError` when the UPI ID is malformed or the amount is not a positive integer. The amount is written as rupees with two decimals without floating point.

- [ ] **Step 1: Write the failing tests**

`packages/tools/invoice/src/upi.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildUpiPayload } from './upi';

describe('buildUpiPayload', () => {
  it('builds a upi://pay link', () => {
    expect(
      buildUpiPayload({
        upiId: 'asha@okhdfc',
        payeeName: 'Asha Rao Consulting',
        amountMinor: 7776000,
        note: 'Invoice 2026-27/0001',
      }),
    ).toBe('upi://pay?pa=asha@okhdfc&pn=Asha%20Rao%20Consulting&am=77760.00&cu=INR&tn=Invoice%202026-27%2F0001');
  });

  it('omits the note when there is none', () => {
    expect(buildUpiPayload({ upiId: 'a.b@upi', payeeName: 'A', amountMinor: 50 })).toBe(
      'upi://pay?pa=a.b@upi&pn=A&am=0.50&cu=INR',
    );
  });

  it('writes whole rupees with two decimals', () => {
    expect(buildUpiPayload({ upiId: 'a@upi', payeeName: 'A', amountMinor: 100 })).toContain('am=1.00');
    expect(buildUpiPayload({ upiId: 'a@upi', payeeName: 'A', amountMinor: 12345 })).toContain('am=123.45');
  });

  it('encodes special characters in the payee name and note', () => {
    const link = buildUpiPayload({ upiId: 'a@upi', payeeName: 'R&D Co.', amountMinor: 100, note: 'a&b=c' });
    expect(link).toContain('pn=R%26D%20Co.');
    expect(link).toContain('tn=a%26b%3Dc');
  });

  it('rejects a malformed UPI id or a non-positive amount', () => {
    expect(() => buildUpiPayload({ upiId: 'no-at', payeeName: 'A', amountMinor: 100 })).toThrow(RangeError);
    expect(() => buildUpiPayload({ upiId: 'a@upi&x=1', payeeName: 'A', amountMinor: 100 })).toThrow(RangeError);
    expect(() => buildUpiPayload({ upiId: 'a@upi', payeeName: 'A', amountMinor: 0 })).toThrow(RangeError);
    expect(() => buildUpiPayload({ upiId: 'a@upi', payeeName: 'A', amountMinor: 1.5 })).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tool-invoice test -- upi`
Expected: FAIL (cannot resolve `./upi`).

- [ ] **Step 3: Implement**

`packages/tools/invoice/src/upi.ts`:
```ts
import type { Minor } from '@solokit/core';

const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

export interface UpiInput {
  upiId: string;
  payeeName: string;
  amountMinor: Minor;
  note?: string;
}

/** A upi://pay link a UPI app can open or scan. The amount is in rupees with two decimals. */
export function buildUpiPayload({ upiId, payeeName, amountMinor, note }: UpiInput): string {
  if (!UPI_ID.test(upiId)) throw new RangeError(`"${upiId}" is not a valid UPI id`);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new RangeError('The UPI amount must be a positive whole number of paise');
  }
  const amount = `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, '0')}`;
  const parts = [`pa=${upiId}`, `pn=${encodeURIComponent(payeeName)}`, `am=${amount}`, 'cu=INR'];
  if (note) parts.push(`tn=${encodeURIComponent(note)}`);
  return `upi://pay?${parts.join('&')}`;
}
```

- [ ] **Step 4: Export, run tests and typecheck**

Append to `packages/tools/invoice/src/index.ts`:
```ts
export * from './upi';
```
Run: `pnpm --filter @solokit/tool-invoice test` then `pnpm --filter @solokit/tool-invoice typecheck`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(invoice): add UPI payment link builder

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Legal declarations

**Files:**
- Create: `packages/tools/invoice/src/declarations.ts`
- Modify: `src/index.ts`
- Test: `src/declarations.test.ts`

**Interfaces:**
- Consumes: `SupplyMode` from `@solokit/tax-engines`; `SellerProfile`.
- Produces: `buildDeclarations(input: { seller: SellerProfile; mode: SupplyMode; exemptSupply: boolean; reverseCharge: boolean; isProforma: boolean; tdsRatePercent?: number }): string[]`. Order: proforma, seller-status line (composition / exempt / unregistered), export, reverse charge, TDS.

- [ ] **Step 1: Write the failing tests**

`packages/tools/invoice/src/declarations.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildDeclarations } from './declarations';
import { makeSeller } from './testing';

const base = { seller: makeSeller(), mode: 'intra-state' as const, exemptSupply: false, reverseCharge: false, isProforma: false };

describe('buildDeclarations', () => {
  it('has nothing to say for an ordinary tax invoice', () => {
    expect(buildDeclarations(base)).toEqual([]);
  });

  it('prints the mandatory composition declaration', () => {
    expect(buildDeclarations({ ...base, seller: makeSeller({ gstStatus: 'composition' }), mode: 'no-tax' })).toEqual([
      'Composition taxable person, not eligible to collect tax on supplies.',
    ]);
  });

  it('explains exempt supplies', () => {
    expect(buildDeclarations({ ...base, mode: 'no-tax', exemptSupply: true })).toEqual([
      'Exempt supply: no tax is charged on this bill of supply.',
    ]);
  });

  it('notes that an unregistered seller is not registered, unless switched off', () => {
    const unregistered = makeSeller({ gstStatus: 'unregistered', gstin: undefined });
    expect(buildDeclarations({ ...base, seller: unregistered, mode: 'no-tax' })).toEqual(['Not registered under GST.']);
    const quiet = makeSeller({ gstStatus: 'unregistered', gstin: undefined, unregisteredNote: false });
    expect(buildDeclarations({ ...base, seller: quiet, mode: 'no-tax' })).toEqual([]);
  });

  it('states the LUT for exports, with the number when known', () => {
    expect(buildDeclarations({ ...base, mode: 'export-lut' })).toEqual([
      'Supply meant for export under Letter of Undertaking (LUT) without payment of integrated tax.',
    ]);
    const withLut = makeSeller({ lutNumber: 'AD270326012345Z' });
    expect(buildDeclarations({ ...base, seller: withLut, mode: 'export-lut' })).toEqual([
      'Supply meant for export under Letter of Undertaking (LUT No. AD270326012345Z) without payment of integrated tax.',
    ]);
  });

  it('flags reverse charge', () => {
    expect(buildDeclarations({ ...base, reverseCharge: true })).toEqual([
      'Tax on this supply is payable on reverse charge basis by the recipient.',
    ]);
  });

  it('mentions TDS when it applies', () => {
    expect(buildDeclarations({ ...base, tdsRatePercent: 10 })).toEqual([
      'TDS at 10% is expected to be deducted by the client. Net payable is shown after this deduction.',
    ]);
    expect(buildDeclarations({ ...base, tdsRatePercent: 0 })).toEqual([]);
  });

  it('marks a proforma and keeps a stable order', () => {
    const lines = buildDeclarations({
      ...base,
      isProforma: true,
      reverseCharge: true,
      tdsRatePercent: 2.5,
    });
    expect(lines).toEqual([
      'This is a proforma invoice. It is not a tax invoice.',
      'Tax on this supply is payable on reverse charge basis by the recipient.',
      'TDS at 2.5% is expected to be deducted by the client. Net payable is shown after this deduction.',
    ]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tool-invoice test -- declarations`
Expected: FAIL (cannot resolve `./declarations`).

- [ ] **Step 3: Implement**

`packages/tools/invoice/src/declarations.ts`:
```ts
import type { SupplyMode } from '@solokit/tax-engines';
import type { SellerProfile } from './model';

export interface DeclarationInput {
  seller: SellerProfile;
  mode: SupplyMode;
  exemptSupply: boolean;
  reverseCharge: boolean;
  isProforma: boolean;
  tdsRatePercent?: number;
}

/** The statements an Indian invoice has to carry for this kind of supply. */
export function buildDeclarations({
  seller,
  mode,
  exemptSupply,
  reverseCharge,
  isProforma,
  tdsRatePercent,
}: DeclarationInput): string[] {
  const lines: string[] = [];

  if (isProforma) lines.push('This is a proforma invoice. It is not a tax invoice.');

  if (seller.gstStatus === 'composition') {
    lines.push('Composition taxable person, not eligible to collect tax on supplies.');
  } else if (seller.gstStatus === 'regular' && exemptSupply) {
    lines.push('Exempt supply: no tax is charged on this bill of supply.');
  } else if (seller.gstStatus === 'unregistered' && seller.unregisteredNote !== false) {
    lines.push('Not registered under GST.');
  }

  if (mode === 'export-lut') {
    const lut = seller.lutNumber ? `Letter of Undertaking (LUT No. ${seller.lutNumber})` : 'Letter of Undertaking (LUT)';
    lines.push(`Supply meant for export under ${lut} without payment of integrated tax.`);
  }

  if (reverseCharge) lines.push('Tax on this supply is payable on reverse charge basis by the recipient.');

  if (tdsRatePercent !== undefined && tdsRatePercent > 0) {
    lines.push(`TDS at ${tdsRatePercent}% is expected to be deducted by the client. Net payable is shown after this deduction.`);
  }
  return lines;
}
```

- [ ] **Step 4: Export, run tests and typecheck**

Append to `packages/tools/invoice/src/index.ts`:
```ts
export * from './declarations';
```
Run: `pnpm --filter @solokit/tool-invoice test` then `pnpm --filter @solokit/tool-invoice typecheck`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(invoice): add legal declarations for each kind of supply

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The invoice document view-model

**Files:**
- Create: `packages/tools/invoice/src/document.ts`
- Modify: `src/index.ts`
- Test: `src/document.test.ts`

**Interfaces:**
- Consumes: `calculateGst`, `getStateByCode`, `type SupplyMode` from `@solokit/tax-engines`; `amountInWords` from `@solokit/core`; `formatIsoDate` is NOT available here (it lives in the ui package), so this task formats dates itself with a small helper; `formatAmount`, `formatQuantity`, `buildUpiPayload`, `buildDeclarations`, model types.
- Produces:
  - `DocParty { name: string; lines: string[]; gstin?: string; pan?: string; email?: string; phone?: string }`
  - `DocLine { number: number; description: string; code: string; quantity: string; rate: string; discount: string; taxable: string; taxRate: string; taxAmount: string; amount: string }`
  - `DocTotalRow { label: string; amount: string; emphasis?: 'total' | 'net' | 'muted' }`
  - `InvoiceDocument { title; number; issueDate; dueDate?; currency; mode; showTax; showCode; showDiscount; seller; client; placeOfSupply?; lines; totals; amountInWords; declarations; notes?; terms?; payment: { bank?: { label: string; value: string }[]; upi?: { id: string; payload: string } }; logoDataUrl? }`
  - `buildInvoiceDocument(invoice: InvoiceRecord): InvoiceDocument`
  - `formatDisplayDate(iso: string): string` ("2026-10-14" -> "14 Oct 2026")

Behaviour:
- Title: proforma -> "Proforma Invoice"; otherwise from the GST result (`tax-invoice` "Tax Invoice", `bill-of-supply` "Bill of Supply", `invoice` "Invoice").
- `showTax` is true only for `intra-state` / `inter-state`; `showCode` when any line has a code; `showDiscount` when any line has a discount greater than zero.
- Line amount is the taxable value plus tax, or only the taxable value under reverse charge. Tax columns show `"{rate}%"` and the tax total for that line when `showTax`, otherwise empty strings.
- Totals: Subtotal (gross) and Discount rows only when discounts exist; a "Taxable value" row when tax is shown, otherwise a "Subtotal" row only when discounts exist; tax rows grouped by rate (CGST/SGST at half the rate, or IGST), labelled with "(reverse charge)" and muted under reverse charge; "Round off" when non-zero; "Total"; then TDS (negative, muted, "deducted by client"), "Advance received" (negative, muted) and "Net payable" only when either exists.
- Amount in words is of the grand total, in the invoice currency.
- UPI block only for INR invoices with a UPI id and a positive net payable (amount = net payable).
- Bank rows: Account name, Account number, IFSC, Bank (with branch when present).

- [ ] **Step 1: Write the failing tests**

`packages/tools/invoice/src/document.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildInvoiceDocument, formatDisplayDate } from './document';
import { makeClient, makeInvoice, makeSeller } from './testing';

const labels = (doc: ReturnType<typeof buildInvoiceDocument>) => doc.totals.map((row) => row.label);
const amounts = (doc: ReturnType<typeof buildInvoiceDocument>) => doc.totals.map((row) => row.amount);

describe('formatDisplayDate', () => {
  it('formats an ISO date', () => {
    expect(formatDisplayDate('2026-10-14')).toBe('14 Oct 2026');
    expect(formatDisplayDate('2026-01-05')).toBe('5 Jan 2026');
  });
});

describe('buildInvoiceDocument: a regular intra-state tax invoice', () => {
  const doc = buildInvoiceDocument(makeInvoice());

  it('titles and numbers the document', () => {
    expect(doc.title).toBe('Tax Invoice');
    expect(doc.number).toBe('2026-27/0001');
    expect(doc.issueDate).toBe('14 Oct 2026');
    expect(doc.currency).toBe('INR');
    expect(doc.mode).toBe('intra-state');
    expect(doc.showTax).toBe(true);
    expect(doc.showCode).toBe(true);
    expect(doc.showDiscount).toBe(false);
  });

  it('formats the line', () => {
    expect(doc.lines).toEqual([
      {
        number: 1,
        description: 'Consulting',
        code: '998312',
        quantity: '24 hrs',
        rate: '₹3,000.00',
        discount: '',
        taxable: '₹72,000.00',
        taxRate: '18%',
        taxAmount: '₹12,960.00',
        amount: '₹84,960.00',
      },
    ]);
  });

  it('splits the tax and totals the invoice', () => {
    expect(labels(doc)).toEqual(['Taxable value', 'CGST @9%', 'SGST @9%', 'Total']);
    expect(amounts(doc)).toEqual(['₹72,000.00', '₹6,480.00', '₹6,480.00', '₹84,960.00']);
    expect(doc.totals[3]?.emphasis).toBe('total');
    expect(doc.amountInWords).toBe('Eighty-Four Thousand Nine Hundred Sixty Rupees Only');
  });

  it('describes the parties and the place of supply', () => {
    expect(doc.seller.name).toBe('Asha Rao Consulting');
    expect(doc.seller.gstin).toBe('27AAPFU0939F1ZV');
    expect(doc.seller.lines).toEqual(['12 Linking Road', 'Mumbai - 400050', 'Maharashtra']);
    expect(doc.client.name).toBe('Northwind Traders');
    expect(doc.client.lines).toEqual(['4 MG Road', 'Pune - 411001', 'Maharashtra']);
    expect(doc.placeOfSupply).toBe('Maharashtra');
  });

  it('adds payment details: bank rows and a UPI link for the total', () => {
    expect(doc.payment.bank).toEqual([
      { label: 'Account name', value: 'Asha Rao Consulting' },
      { label: 'Account number', value: '123456789012' },
      { label: 'IFSC', value: 'HDFC0001234' },
      { label: 'Bank', value: 'HDFC Bank, Bandra West' },
    ]);
    expect(doc.payment.upi?.id).toBe('asha@okhdfc');
    expect(doc.payment.upi?.payload).toBe(
      'upi://pay?pa=asha@okhdfc&pn=Asha%20Rao%20Consulting&am=84960.00&cu=INR&tn=Invoice%202026-27%2F0001',
    );
    expect(doc.declarations).toEqual([]);
  });
});

describe('buildInvoiceDocument: tax variations', () => {
  it('uses IGST across states', () => {
    const doc = buildInvoiceDocument(
      makeInvoice({
        client: makeClient({ address: { line1: '1 Brigade Rd', city: 'Bengaluru', stateCode: '29', country: 'India' } }),
        placeOfSupplyStateCode: '29',
      }),
    );
    expect(doc.mode).toBe('inter-state');
    expect(labels(doc)).toEqual(['Taxable value', 'IGST @18%', 'Total']);
    expect(doc.lines[0]?.taxAmount).toBe('₹12,960.00');
    expect(doc.placeOfSupply).toBe('Karnataka');
  });

  it('groups tax by rate', () => {
    const doc = buildInvoiceDocument(
      makeInvoice({
        lines: [
          { id: 'a', description: 'Design', quantity: 1, unit: 'fixed', rate: 1000000, gstRate: 18 },
          { id: 'b', description: 'Books', quantity: 2, unit: 'items', rate: 500000, gstRate: 5 },
        ],
      }),
    );
    expect(labels(doc)).toEqual(['Taxable value', 'CGST @9%', 'SGST @9%', 'CGST @2.5%', 'SGST @2.5%', 'Total']);
    expect(doc.lines[0]?.quantity).toBe('Fixed fee');
  });

  it('shows subtotal, discount and taxable value when a discount is given', () => {
    const doc = buildInvoiceDocument(
      makeInvoice({
        lines: [
          {
            id: 'a',
            description: 'Retainer',
            quantity: 1,
            unit: 'retainer',
            rate: 1000000,
            gstRate: 18,
            discount: { kind: 'percent', percent: 10 },
          },
        ],
      }),
    );
    expect(doc.showDiscount).toBe(true);
    expect(labels(doc)).toEqual(['Subtotal', 'Discount', 'Taxable value', 'CGST @9%', 'SGST @9%', 'Total']);
    expect(amounts(doc).slice(0, 3)).toEqual(['₹10,000.00', '-₹1,000.00', '₹9,000.00']);
    expect(doc.lines[0]?.discount).toBe('-₹1,000.00');
  });

  it('shows the round-off line', () => {
    const doc = buildInvoiceDocument(
      makeInvoice({ lines: [{ id: 'a', description: 'Item', quantity: 1, unit: 'items', rate: 33333, gstRate: 18 }] }),
    );
    expect(labels(doc)).toContain('Round off');
    expect(doc.totals.at(-1)).toMatchObject({ label: 'Total', amount: '₹393.00' });
  });

  it('marks the tax as payable by the recipient under reverse charge', () => {
    const doc = buildInvoiceDocument(makeInvoice({ reverseCharge: true }));
    expect(labels(doc)).toEqual([
      'Taxable value',
      'CGST @9% (reverse charge)',
      'SGST @9% (reverse charge)',
      'Total',
    ]);
    expect(doc.totals[1]?.emphasis).toBe('muted');
    expect(doc.totals.at(-1)?.amount).toBe('₹72,000.00');
    expect(doc.lines[0]?.amount).toBe('₹72,000.00');
    expect(doc.declarations).toContain('Tax on this supply is payable on reverse charge basis by the recipient.');
  });
});

describe('buildInvoiceDocument: TDS and advances', () => {
  it('shows TDS and the net payable', () => {
    const doc = buildInvoiceDocument(makeInvoice({ tds: { ratePercent: 10 } }));
    expect(labels(doc).slice(-3)).toEqual(['Total', 'TDS @10% (deducted by client)', 'Net payable']);
    expect(amounts(doc).slice(-3)).toEqual(['₹84,960.00', '-₹7,200.00', '₹77,760.00']);
    expect(doc.totals.at(-1)?.emphasis).toBe('net');
    expect(doc.payment.upi?.payload).toContain('am=77760.00');
    expect(doc.declarations).toEqual([
      'TDS at 10% is expected to be deducted by the client. Net payable is shown after this deduction.',
    ]);
  });

  it('shows an advance', () => {
    const doc = buildInvoiceDocument(makeInvoice({ advanceReceived: 3000000 }));
    expect(labels(doc).slice(-3)).toEqual(['Total', 'Advance received', 'Net payable']);
    expect(amounts(doc).slice(-2)).toEqual(['-₹30,000.00', '₹54,960.00']);
  });

  it('leaves out the UPI block when nothing is left to pay', () => {
    const doc = buildInvoiceDocument(makeInvoice({ advanceReceived: 8496000 }));
    expect(doc.payment.upi).toBeUndefined();
  });
});

describe('buildInvoiceDocument: other seller types and documents', () => {
  const lines = [{ id: 'a', description: 'Design work', quantity: 10, unit: 'hours' as const, rate: 50000 }];

  it('issues a plain invoice for an unregistered seller', () => {
    const doc = buildInvoiceDocument(
      makeInvoice({ seller: makeSeller({ gstStatus: 'unregistered', gstin: undefined }), placeOfSupplyStateCode: undefined, lines }),
    );
    expect(doc.title).toBe('Invoice');
    expect(doc.showTax).toBe(false);
    expect(labels(doc)).toEqual(['Total']);
    expect(amounts(doc)).toEqual(['₹5,000.00']);
    expect(doc.lines[0]).toMatchObject({ taxRate: '', taxAmount: '', amount: '₹5,000.00' });
    expect(doc.placeOfSupply).toBeUndefined();
    expect(doc.declarations).toEqual(['Not registered under GST.']);
  });

  it('issues a bill of supply for a composition seller', () => {
    const doc = buildInvoiceDocument(makeInvoice({ seller: makeSeller({ gstStatus: 'composition' }), lines }));
    expect(doc.title).toBe('Bill of Supply');
    expect(doc.declarations).toEqual(['Composition taxable person, not eligible to collect tax on supplies.']);
  });

  it('issues a bill of supply for exempt supplies', () => {
    const doc = buildInvoiceDocument(makeInvoice({ exemptSupply: true, lines }));
    expect(doc.title).toBe('Bill of Supply');
    expect(doc.mode).toBe('no-tax');
  });

  it('zero-rates an export in a foreign currency and does not round it', () => {
    const doc = buildInvoiceDocument(
      makeInvoice({
        seller: makeSeller({ lutNumber: 'AD270326012345Z' }),
        client: makeClient({ gstin: undefined, address: { line1: '1 Main St', city: 'Austin', country: 'United States' } }),
        currency: 'USD',
        isExport: true,
        placeOfSupplyStateCode: undefined,
        lines: [{ id: 'a', description: 'Consulting', quantity: 1, unit: 'fixed', rate: 123456, gstRate: 18 }],
      }),
    );
    expect(doc.title).toBe('Tax Invoice');
    expect(doc.mode).toBe('export-lut');
    expect(doc.showTax).toBe(false);
    expect(labels(doc)).toEqual(['Total']);
    expect(amounts(doc)).toEqual(['$1,234.56']);
    expect(doc.amountInWords).toBe('One Thousand Two Hundred Thirty-Four US Dollars and Fifty-Six Cents Only');
    expect(doc.placeOfSupply).toBe('Outside India (export)');
    expect(doc.client.lines).toEqual(['1 Main St', 'Austin', 'United States']);
    expect(doc.payment.upi).toBeUndefined();
    expect(doc.declarations[0]).toContain('LUT No. AD270326012345Z');
  });

  it('titles a proforma regardless of seller type', () => {
    expect(buildInvoiceDocument(makeInvoice({ kind: 'proforma' })).title).toBe('Proforma Invoice');
  });

  it('carries the logo, notes and terms through', () => {
    const doc = buildInvoiceDocument(
      makeInvoice({
        seller: makeSeller({ logoDataUrl: 'data:image/png;base64,AAAA' }),
        notes: 'Thank you!',
        terms: 'Pay within 15 days.',
        dueDate: '2026-10-29',
      }),
    );
    expect(doc.logoDataUrl).toBe('data:image/png;base64,AAAA');
    expect(doc.notes).toBe('Thank you!');
    expect(doc.terms).toBe('Pay within 15 days.');
    expect(doc.dueDate).toBe('29 Oct 2026');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tool-invoice test -- document`
Expected: FAIL (cannot resolve `./document`).

- [ ] **Step 3: Implement**

`packages/tools/invoice/src/document.ts`:
```ts
import { amountInWords } from '@solokit/core';
import { calculateGst, getStateByCode, type GstLineResult, type SupplyMode } from '@solokit/tax-engines';
import { formatAmount, type CurrencyCode } from './currencies';
import { buildDeclarations } from './declarations';
import type { Address, Client, InvoiceRecord, SellerProfile } from './model';
import { buildUpiPayload } from './upi';
import { formatQuantity } from './units';

export interface DocParty {
  name: string;
  lines: string[];
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
}

export interface DocLine {
  number: number;
  description: string;
  code: string;
  quantity: string;
  rate: string;
  discount: string;
  taxable: string;
  taxRate: string;
  taxAmount: string;
  amount: string;
}

export interface DocTotalRow {
  label: string;
  amount: string;
  emphasis?: 'total' | 'net' | 'muted';
}

export interface InvoiceDocument {
  title: string;
  number: string;
  issueDate: string;
  dueDate?: string;
  currency: CurrencyCode;
  mode: SupplyMode;
  showTax: boolean;
  showCode: boolean;
  showDiscount: boolean;
  seller: DocParty;
  client: DocParty;
  placeOfSupply?: string;
  lines: DocLine[];
  totals: DocTotalRow[];
  amountInWords: string;
  declarations: string[];
  notes?: string;
  terms?: string;
  payment: {
    bank?: { label: string; value: string }[];
    upi?: { id: string; payload: string };
  };
  logoDataUrl?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "2026-10-14" -> "14 Oct 2026". Pure string handling, so time zones cannot shift the day. */
export function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

function addressLines(address: Address): string[] {
  const lines = [address.line1];
  if (address.line2) lines.push(address.line2);
  lines.push(address.postalCode ? `${address.city} - ${address.postalCode}` : address.city);
  const state = address.stateCode ? getStateByCode(address.stateCode)?.name : undefined;
  if (state) lines.push(state);
  else if (address.country && address.country !== 'India') lines.push(address.country);
  return lines;
}

function party(source: SellerProfile | Client): DocParty {
  const result: DocParty = { name: source.name, lines: addressLines(source.address) };
  if (source.gstin) result.gstin = source.gstin;
  if (source.pan) result.pan = source.pan;
  if (source.email) result.email = source.email;
  if (source.phone) result.phone = source.phone;
  return result;
}

function titleFor(invoice: InvoiceRecord, documentType: string): string {
  if (invoice.kind === 'proforma') return 'Proforma Invoice';
  if (documentType === 'tax-invoice') return 'Tax Invoice';
  if (documentType === 'bill-of-supply') return 'Bill of Supply';
  return 'Invoice';
}

export function buildInvoiceDocument(invoice: InvoiceRecord): InvoiceDocument {
  const money = (minor: number) => formatAmount(minor, invoice.currency);
  const taxLines: GstLineResult[] = [];

  const result = calculateGst({
    sellerStatus: invoice.seller.gstStatus,
    ...(invoice.seller.address.stateCode ? { sellerStateCode: invoice.seller.address.stateCode } : {}),
    ...(invoice.placeOfSupplyStateCode ? { placeOfSupplyStateCode: invoice.placeOfSupplyStateCode } : {}),
    isExport: invoice.isExport,
    exemptSupply: invoice.exemptSupply,
    reverseCharge: invoice.reverseCharge,
    lines: invoice.lines.map((line) => ({
      quantity: line.quantity,
      unitRate: line.rate,
      ...(line.discount ? { discount: line.discount } : {}),
      ...(line.gstRate !== undefined ? { gstRate: line.gstRate } : {}),
    })),
    ...(invoice.roundOff !== undefined ? { roundOff: invoice.roundOff } : {}),
    ...(invoice.tds ? { tds: invoice.tds } : {}),
    ...(invoice.advanceReceived !== undefined ? { advanceReceived: invoice.advanceReceived } : {}),
  });
  taxLines.push(...result.lines);

  const { mode, totals, reverseCharge } = result;
  const showTax = mode === 'intra-state' || mode === 'inter-state';
  const showCode = invoice.lines.some((line) => Boolean(line.code));
  const grossTotal = result.lines.reduce((sum, line) => sum + line.gross, 0);
  const discountTotal = result.lines.reduce((sum, line) => sum + line.discount, 0);
  const showDiscount = discountTotal > 0;

  const lines: DocLine[] = invoice.lines.map((line, index) => {
    const calculated = taxLines[index] as GstLineResult;
    const tax = calculated.cgst + calculated.sgst + calculated.igst;
    return {
      number: index + 1,
      description: line.description,
      code: line.code ?? '',
      quantity: formatQuantity(line.quantity, line.unit),
      rate: money(line.rate),
      discount: calculated.discount > 0 ? money(-calculated.discount) : '',
      taxable: money(calculated.taxable),
      taxRate: showTax ? `${calculated.gstRate}%` : '',
      taxAmount: showTax ? money(tax) : '',
      amount: money(reverseCharge ? calculated.taxable : calculated.total),
    };
  });

  const rows: DocTotalRow[] = [];
  if (showDiscount) {
    rows.push({ label: 'Subtotal', amount: money(grossTotal) });
    rows.push({ label: 'Discount', amount: money(-discountTotal) });
  }
  if (showTax) {
    rows.push({ label: 'Taxable value', amount: money(totals.taxable) });
  } else if (showDiscount || totals.roundOff !== 0) {
    if (!showDiscount) rows.push({ label: 'Subtotal', amount: money(totals.taxable) });
    else rows.push({ label: 'Taxable value', amount: money(totals.taxable) });
  }

  if (showTax) {
    const rates = [...new Set(taxLines.map((line) => line.gstRate))].sort((a, b) => b - a);
    const suffix = reverseCharge ? ' (reverse charge)' : '';
    const emphasis = reverseCharge ? ({ emphasis: 'muted' } as const) : {};
    for (const rate of rates) {
      const atRate = taxLines.filter((line) => line.gstRate === rate);
      const sum = (pick: (line: GstLineResult) => number) => atRate.reduce((total, line) => total + pick(line), 0);
      if (mode === 'intra-state') {
        rows.push({ label: `CGST @${rate / 2}%${suffix}`, amount: money(sum((line) => line.cgst)), ...emphasis });
        rows.push({ label: `SGST @${rate / 2}%${suffix}`, amount: money(sum((line) => line.sgst)), ...emphasis });
      } else {
        rows.push({ label: `IGST @${rate}%${suffix}`, amount: money(sum((line) => line.igst)), ...emphasis });
      }
    }
  }

  if (totals.roundOff !== 0) rows.push({ label: 'Round off', amount: money(totals.roundOff) });
  rows.push({ label: 'Total', amount: money(totals.grandTotal), emphasis: 'total' });

  if (result.tds > 0) {
    rows.push({
      label: `TDS @${invoice.tds?.ratePercent ?? 0}% (deducted by client)`,
      amount: money(-result.tds),
      emphasis: 'muted',
    });
  }
  if (result.advance > 0) rows.push({ label: 'Advance received', amount: money(-result.advance), emphasis: 'muted' });
  if (result.tds > 0 || result.advance > 0) {
    rows.push({ label: 'Net payable', amount: money(result.netPayable), emphasis: 'net' });
  }

  const payment: InvoiceDocument['payment'] = {};
  const { bank } = invoice.seller;
  if (bank) {
    payment.bank = [
      { label: 'Account name', value: bank.accountName },
      { label: 'Account number', value: bank.accountNumber },
      { label: 'IFSC', value: bank.ifsc },
      { label: 'Bank', value: bank.branch ? `${bank.bankName}, ${bank.branch}` : bank.bankName },
    ];
  }
  if (invoice.currency === 'INR' && invoice.seller.upiId && result.netPayable > 0) {
    payment.upi = {
      id: invoice.seller.upiId,
      payload: buildUpiPayload({
        upiId: invoice.seller.upiId,
        payeeName: invoice.seller.name,
        amountMinor: result.netPayable,
        note: `Invoice ${invoice.number}`,
      }),
    };
  }

  let placeOfSupply: string | undefined;
  if (mode === 'export-lut') placeOfSupply = 'Outside India (export)';
  else if (showTax && invoice.placeOfSupplyStateCode) placeOfSupply = getStateByCode(invoice.placeOfSupplyStateCode)?.name;

  const document: InvoiceDocument = {
    title: titleFor(invoice, result.documentType),
    number: invoice.number,
    issueDate: formatDisplayDate(invoice.issueDate),
    currency: invoice.currency,
    mode,
    showTax,
    showCode,
    showDiscount,
    seller: party(invoice.seller),
    client: party(invoice.client),
    lines,
    totals: rows,
    amountInWords: amountInWords(totals.grandTotal, invoice.currency),
    declarations: buildDeclarations({
      seller: invoice.seller,
      mode,
      exemptSupply: invoice.exemptSupply,
      reverseCharge,
      isProforma: invoice.kind === 'proforma',
      ...(invoice.tds ? { tdsRatePercent: invoice.tds.ratePercent } : {}),
    }),
    payment,
  };
  if (invoice.dueDate) document.dueDate = formatDisplayDate(invoice.dueDate);
  if (placeOfSupply) document.placeOfSupply = placeOfSupply;
  if (invoice.notes) document.notes = invoice.notes;
  if (invoice.terms) document.terms = invoice.terms;
  if (invoice.seller.logoDataUrl) document.logoDataUrl = invoice.seller.logoDataUrl;
  return document;
}
```

- [ ] **Step 4: Export, run tests and typecheck**

Append to `packages/tools/invoice/src/index.ts`:
```ts
export * from './document';
```
Run: `pnpm --filter @solokit/tool-invoice test`
Expected: PASS (every test file).
If any hand-computed expectation does not match, do not change the test or code to force a pass: report the exact actual and expected values.
Run: `pnpm --filter @solokit/tool-invoice typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(invoice): build the invoice document view-model

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: SAC code search

**Files:**
- Create: `packages/tools/invoice/src/codes.ts`
- Modify: `src/index.ts`
- Test: `src/codes.test.ts`

**Interfaces:**
- Produces: `SAC_AS_OF = '2026-10-14'`, `interface ServiceCode { code: string; description: string }`, `COMMON_SERVICE_CODES: readonly ServiceCode[]`, `searchServiceCodes(query: string, limit?: number): ServiceCode[]`. The list is a short set of codes freelancers and consultants commonly use; users can always type any other code. It is not an official register: verify against the official SAC list.

- [ ] **Step 1: Write the failing tests**

`packages/tools/invoice/src/codes.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { COMMON_SERVICE_CODES, SAC_AS_OF, searchServiceCodes } from './codes';

describe('service codes', () => {
  it('records when the list was checked', () => {
    expect(SAC_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('has unique six-digit codes with descriptions', () => {
    const codes = COMMON_SERVICE_CODES.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const entry of COMMON_SERVICE_CODES) {
      expect(entry.code).toMatch(/^\d{6}$/);
      expect(entry.description).not.toBe('');
    }
  });

  it('finds codes by number prefix', () => {
    const results = searchServiceCodes('99831');
    expect(results.length).toBeGreaterThan(1);
    expect(results.every((entry) => entry.code.startsWith('99831'))).toBe(true);
  });

  it('finds codes by words in the description, ignoring case', () => {
    const results = searchServiceCodes('IT CONSULTING');
    expect(results.map((entry) => entry.code)).toContain('998313');
  });

  it('requires every word to match', () => {
    expect(searchServiceCodes('consulting zebra')).toEqual([]);
  });

  it('returns nothing for an empty query and respects the limit', () => {
    expect(searchServiceCodes('  ')).toEqual([]);
    expect(searchServiceCodes('services', 2).length).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tool-invoice test -- codes`
Expected: FAIL (cannot resolve `./codes`).

- [ ] **Step 3: Implement**

`packages/tools/invoice/src/codes.ts`:
```ts
/** Date this short list was last checked. It is not an official register. */
export const SAC_AS_OF = '2026-10-14';

export interface ServiceCode {
  code: string;
  description: string;
}

/** Common service accounting codes for freelancers and consultants. Verify against the official SAC list. */
export const COMMON_SERVICE_CODES: readonly ServiceCode[] = [
  { code: '998311', description: 'Management consulting and management services' },
  { code: '998312', description: 'Business consulting services' },
  { code: '998313', description: 'Information technology (IT) consulting and support services' },
  { code: '998314', description: 'Information technology (IT) design and development services' },
  { code: '998315', description: 'Hosting and information technology (IT) infrastructure provisioning services' },
  { code: '998319', description: 'Other information technology services' },
  { code: '998361', description: 'Advertising services' },
  { code: '998391', description: 'Specialty design services, including interior, fashion and industrial design' },
  { code: '998399', description: 'Other professional, technical and business services' },
  { code: '999293', description: 'Commercial training and coaching services' },
];

/** Matches the start of a code, or every word of the query against the description. */
export function searchServiceCodes(query: string, limit = 8): ServiceCode[] {
  const text = query.trim().toLowerCase();
  if (text === '') return [];
  const words = text.split(/\s+/);
  const matches = COMMON_SERVICE_CODES.filter((entry) => {
    if (/^\d+$/.test(text)) return entry.code.startsWith(text);
    const description = entry.description.toLowerCase();
    return words.every((word) => description.includes(word));
  });
  return matches.slice(0, limit).map((entry) => ({ ...entry }));
}
```

- [ ] **Step 4: Export, run tests and typecheck**

Append to `packages/tools/invoice/src/index.ts`:
```ts
export * from './codes';
```
Run: `pnpm --filter @solokit/tool-invoice test` then `pnpm --filter @solokit/tool-invoice typecheck`
Expected: PASS and no type errors. (The "IT CONSULTING" test matches because every word appears in the description of 998313: "information technology (IT) consulting".)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(invoice): add common SAC code search

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Themes

**Files:**
- Create: `packages/tools/invoice/src/themes.ts`
- Modify: `src/index.ts`
- Test: `src/themes.test.ts`

**Interfaces:**
- Produces:
  - `FONT_OPTIONS: readonly { id: FontId; label: string; group: 'sans' | 'serif' | 'mono' }[]`, `type FontId = 'inter' | 'poppins' | 'source-serif-4' | 'ibm-plex-mono' | 'geist-mono'`
  - `type ThemeLayout = 'classic' | 'modern' | 'minimal' | 'bold' | 'consultant' | 'formal'`
  - `interface InvoiceTheme extends StoredRecord { id: string; name: string; layout: ThemeLayout; accent: string; text: string; background: string; fontId: FontId }`
  - `PRESET_THEMES: readonly InvoiceTheme[]` (ids `classic`, `modern`, `minimal`, `bold`, `consultant`, `formal`), `DEFAULT_THEME_ID = 'classic'`, `isPresetThemeId(id)`
  - `contrastRatio(foreground: string, background: string): number` (WCAG, `#RRGGBB`)
  - `validateTheme(theme: InvoiceTheme): Issue[]` (hex formats, text vs background >= 4.5, accent vs background >= 3, and for the band layouts `modern`, `bold`, `consultant` accent vs white >= 4.5)
  - `resolveTheme(id: string, custom: readonly InvoiceTheme[]): InvoiceTheme` (custom first, then preset, then the default)
  - `createCustomTheme(base: InvoiceTheme, changes: Partial<Pick<InvoiceTheme, 'name' | 'accent' | 'text' | 'background' | 'fontId'>>, id: string): InvoiceTheme` (copies the base layout)

- [ ] **Step 1: Write the failing tests**

`packages/tools/invoice/src/themes.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_ID,
  FONT_OPTIONS,
  PRESET_THEMES,
  contrastRatio,
  createCustomTheme,
  isPresetThemeId,
  resolveTheme,
  validateTheme,
} from './themes';

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });

  it('is symmetric and accepts lower-case hex', () => {
    expect(contrastRatio('#ffffff', '#0b1b3a')).toBeCloseTo(contrastRatio('#0B1B3A', '#FFFFFF'), 5);
  });
});

describe('preset themes', () => {
  it('has the six presets, with classic as the default', () => {
    expect(PRESET_THEMES.map((theme) => theme.id)).toEqual(['classic', 'modern', 'minimal', 'bold', 'consultant', 'formal']);
    expect(DEFAULT_THEME_ID).toBe('classic');
    expect(isPresetThemeId('modern')).toBe(true);
    expect(isPresetThemeId('mine')).toBe(false);
  });

  it('passes its own validation', () => {
    for (const theme of PRESET_THEMES) expect(validateTheme(theme), theme.id).toEqual([]);
  });

  it('uses a known layout and font for each preset', () => {
    const fontIds = FONT_OPTIONS.map((font) => font.id);
    for (const theme of PRESET_THEMES) {
      expect(theme.layout).toBe(theme.id);
      expect(fontIds).toContain(theme.fontId);
    }
  });
});

describe('font options', () => {
  it('offers sans, serif and mono fonts', () => {
    const groups = new Set(FONT_OPTIONS.map((font) => font.group));
    expect([...groups].sort()).toEqual(['mono', 'sans', 'serif']);
    expect(FONT_OPTIONS.map((font) => font.id)).toEqual(['inter', 'poppins', 'source-serif-4', 'ibm-plex-mono', 'geist-mono']);
  });
});

describe('validateTheme', () => {
  const base = PRESET_THEMES[0]!;

  it('rejects malformed colours', () => {
    const issues = validateTheme({ ...base, accent: 'blue', text: '#12', background: 'white' });
    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining(['accent', 'text', 'background']));
  });

  it('rejects text that is hard to read on the background', () => {
    const issues = validateTheme({ ...base, text: '#999999', background: '#FFFFFF' });
    expect(issues.map((issue) => issue.path)).toContain('text');
  });

  it('rejects an accent that disappears into the background', () => {
    const issues = validateTheme({ ...base, accent: '#F5F5F5', background: '#FFFFFF' });
    expect(issues.map((issue) => issue.path)).toContain('accent');
  });

  it('needs a dark enough accent for layouts with a coloured band behind white text', () => {
    const modern = PRESET_THEMES.find((theme) => theme.id === 'modern')!;
    // #3B82F6 is about 3.7:1 against white: visible on the page, but too light for white text on top of it.
    expect(validateTheme({ ...modern, accent: '#3B82F6' }).map((issue) => issue.path)).toContain('accent');
    expect(validateTheme({ ...base, accent: '#3B82F6' }).map((issue) => issue.path)).not.toContain('accent');
  });
});

describe('resolveTheme and createCustomTheme', () => {
  it('prefers a custom theme, then a preset, then the default', () => {
    const custom = createCustomTheme(PRESET_THEMES[1]!, { name: 'Mine', accent: '#0F766E' }, 'custom-1');
    expect(resolveTheme('custom-1', [custom])).toBe(custom);
    expect(resolveTheme('modern', [custom]).id).toBe('modern');
    expect(resolveTheme('gone', [custom]).id).toBe(DEFAULT_THEME_ID);
  });

  it('copies the layout from the base and applies the changes', () => {
    const modern = PRESET_THEMES.find((theme) => theme.id === 'modern')!;
    const custom = createCustomTheme(modern, { name: 'Teal', accent: '#0F766E', fontId: 'poppins' }, 'custom-2');
    expect(custom).toMatchObject({ id: 'custom-2', name: 'Teal', layout: 'modern', accent: '#0F766E', fontId: 'poppins', text: modern.text });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tool-invoice test -- themes`
Expected: FAIL (cannot resolve `./themes`).

- [ ] **Step 3: Implement**

`packages/tools/invoice/src/themes.ts`:
```ts
import type { StoredRecord } from '@solokit/storage';
import type { Issue } from './validation';

export type FontId = 'inter' | 'poppins' | 'source-serif-4' | 'ibm-plex-mono' | 'geist-mono';

export interface FontOption {
  id: FontId;
  label: string;
  group: 'sans' | 'serif' | 'mono';
}

/** Every one of these contains the rupee sign and the euro, pound and dollar signs. */
export const FONT_OPTIONS: readonly FontOption[] = [
  { id: 'inter', label: 'Inter', group: 'sans' },
  { id: 'poppins', label: 'Poppins', group: 'sans' },
  { id: 'source-serif-4', label: 'Source Serif 4', group: 'serif' },
  { id: 'ibm-plex-mono', label: 'IBM Plex Mono', group: 'mono' },
  { id: 'geist-mono', label: 'Geist Mono', group: 'mono' },
];

export type ThemeLayout = 'classic' | 'modern' | 'minimal' | 'bold' | 'consultant' | 'formal';

export interface InvoiceTheme extends StoredRecord {
  name: string;
  layout: ThemeLayout;
  /** Colours as #RRGGBB. */
  accent: string;
  text: string;
  background: string;
  fontId: FontId;
}

export const DEFAULT_THEME_ID = 'classic';

export const PRESET_THEMES: readonly InvoiceTheme[] = [
  { id: 'classic', name: 'Classic', layout: 'classic', accent: '#0B1B3A', text: '#1A1A1A', background: '#FFFFFF', fontId: 'source-serif-4' },
  { id: 'modern', name: 'Modern', layout: 'modern', accent: '#047857', text: '#14213D', background: '#FFFFFF', fontId: 'inter' },
  { id: 'minimal', name: 'Minimal', layout: 'minimal', accent: '#374151', text: '#111827', background: '#FFFFFF', fontId: 'geist-mono' },
  { id: 'bold', name: 'Bold', layout: 'bold', accent: '#0B1B3A', text: '#0B1B3A', background: '#FFFBF2', fontId: 'poppins' },
  { id: 'consultant', name: 'Consultant', layout: 'consultant', accent: '#0F766E', text: '#0F172A', background: '#FFFFFF', fontId: 'inter' },
  { id: 'formal', name: 'Formal', layout: 'formal', accent: '#1F2937', text: '#111827', background: '#FFFFFF', fontId: 'source-serif-4' },
];

export function isPresetThemeId(id: string): boolean {
  return PRESET_THEMES.some((theme) => theme.id === id);
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const BAND_LAYOUTS: readonly ThemeLayout[] = ['modern', 'bold', 'consultant'];

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two #RRGGBB colours (1 to 21). */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

export function validateTheme(theme: InvoiceTheme): Issue[] {
  const issues: Issue[] = [];
  const colours = [
    ['accent', theme.accent],
    ['text', theme.text],
    ['background', theme.background],
  ] as const;
  for (const [path, value] of colours) {
    if (!HEX.test(value)) issues.push({ path, message: 'Use a colour like #0B1B3A' });
  }
  if (issues.length > 0) return issues;

  if (contrastRatio(theme.text, theme.background) < 4.5) {
    issues.push({ path: 'text', message: 'Text is hard to read on this background. Pick a darker text colour or a lighter background.' });
  }
  if (contrastRatio(theme.accent, theme.background) < 3) {
    issues.push({ path: 'accent', message: 'The accent colour is too close to the background to see.' });
  } else if (BAND_LAYOUTS.includes(theme.layout) && contrastRatio('#FFFFFF', theme.accent) < 4.5) {
    issues.push({ path: 'accent', message: 'This layout puts white text on the accent colour. Pick a darker accent.' });
  }
  return issues;
}

export function resolveTheme(id: string, custom: readonly InvoiceTheme[]): InvoiceTheme {
  const found =
    custom.find((theme) => theme.id === id) ??
    PRESET_THEMES.find((theme) => theme.id === id) ??
    PRESET_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID);
  return found as InvoiceTheme;
}

export type ThemeChanges = Partial<Pick<InvoiceTheme, 'name' | 'accent' | 'text' | 'background' | 'fontId'>>;

/** A custom theme keeps the base preset's layout and changes only colours and font. */
export function createCustomTheme(base: InvoiceTheme, changes: ThemeChanges, id: string): InvoiceTheme {
  return { ...base, ...changes, id };
}
```

- [ ] **Step 4: Export, run tests and typecheck**

Append to `packages/tools/invoice/src/index.ts`:
```ts
export * from './themes';
```
Run: `pnpm --filter @solokit/tool-invoice test` then `pnpm --filter @solokit/tool-invoice typecheck`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(invoice): add theme model, presets and contrast validation

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Saved-data repositories

**Files:**
- Create: `packages/tools/invoice/src/repositories.ts`
- Modify: `src/index.ts`
- Test: `src/repositories.test.ts`

**Interfaces:**
- Consumes: `DataStore` from `@solokit/storage`; `formatInvoiceNumber`, `indianFiscalYear`, `nextSequence` from `@solokit/core`; model types and `InvoiceTheme`.
- Produces: `createInvoiceStorage(store: DataStore, options?: { now?: () => Date }): InvoiceStorage` with:
  - `profile.get(): Promise<SellerProfile | undefined>`, `profile.save(profile: SellerProfile): Promise<void>` (always stored under id `me`)
  - `clients.list()` (sorted by name, case-insensitive), `.get(id)`, `.save(client)`, `.remove(id)`
  - `invoices.list()` (newest issue date first, then highest number), `.get(id)`, `.save(invoice): Promise<InvoiceRecord>` (sets `updatedAt`, and `createdAt` when missing), `.remove(id)`, `.nextNumber(issueDate: string): Promise<string>` (uses the seller's `invoicePrefix`, the Indian fiscal year of the date and the highest existing sequence in that year)
  - `themes.list()`, `.save(theme)`, `.remove(id)` (custom themes only)
  - `settings.get(): Promise<InvoiceSettings>` (defaults `{ id: 'invoice', defaultThemeId: 'classic', onboarded: false }`), `settings.update(patch): Promise<InvoiceSettings>`

- [ ] **Step 1: Write the failing tests**

`packages/tools/invoice/src/repositories.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createInvoiceStorage } from './repositories';
import { makeClient, makeInvoice, makeSeller } from './testing';
import { PRESET_THEMES, createCustomTheme } from './themes';

const fixedNow = () => new Date('2026-10-14T12:00:00.000Z');
const setup = () => createInvoiceStorage(createMemoryStore(), { now: fixedNow });

describe('profile', () => {
  it('starts empty and saves under a fixed id', async () => {
    const storage = setup();
    expect(await storage.profile.get()).toBeUndefined();
    await storage.profile.save(makeSeller({ name: 'Asha' }));
    expect((await storage.profile.get())?.name).toBe('Asha');
    expect((await storage.profile.get())?.id).toBe('me');
  });
});

describe('clients', () => {
  it('lists clients by name, ignoring case, and supports get and remove', async () => {
    const storage = setup();
    await storage.clients.save(makeClient({ id: 'b', name: 'beta Ltd' }));
    await storage.clients.save(makeClient({ id: 'a', name: 'Alpha Co' }));
    await storage.clients.save(makeClient({ id: 'c', name: 'Charlie' }));
    expect((await storage.clients.list()).map((client) => client.name)).toEqual(['Alpha Co', 'beta Ltd', 'Charlie']);
    expect((await storage.clients.get('a'))?.name).toBe('Alpha Co');
    await storage.clients.remove('a');
    expect(await storage.clients.get('a')).toBeUndefined();
  });
});

describe('invoices', () => {
  it('stamps createdAt once and updatedAt on every save', async () => {
    const storage = setup();
    const saved = await storage.invoices.save(makeInvoice({ createdAt: '', updatedAt: '' }));
    expect(saved.createdAt).toBe('2026-10-14T12:00:00.000Z');
    expect(saved.updatedAt).toBe('2026-10-14T12:00:00.000Z');

    const later = createInvoiceStorage(createMemoryStore(), { now: () => new Date('2026-11-01T08:00:00.000Z') });
    const resaved = await later.invoices.save({ ...saved });
    expect(resaved.createdAt).toBe('2026-10-14T12:00:00.000Z');
    expect(resaved.updatedAt).toBe('2026-11-01T08:00:00.000Z');
  });

  it('lists newest first and supports get and remove', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0001', issueDate: '2026-10-01' }));
    await storage.invoices.save(makeInvoice({ id: 'b', number: '2026-27/0002', issueDate: '2026-10-14' }));
    await storage.invoices.save(makeInvoice({ id: 'c', number: '2026-27/0003', issueDate: '2026-10-14' }));
    expect((await storage.invoices.list()).map((invoice) => invoice.id)).toEqual(['c', 'b', 'a']);
    expect((await storage.invoices.get('b'))?.number).toBe('2026-27/0002');
    await storage.invoices.remove('b');
    expect(await storage.invoices.get('b')).toBeUndefined();
  });
});

describe('invoice numbers', () => {
  it('starts each financial year at 0001', async () => {
    const storage = setup();
    expect(await storage.invoices.nextNumber('2026-10-14')).toBe('2026-27/0001');
  });

  it('continues after the highest number in the same financial year only', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0001' }));
    await storage.invoices.save(makeInvoice({ id: 'b', number: '2026-27/0007' }));
    await storage.invoices.save(makeInvoice({ id: 'c', number: '2025-26/0099', fiscalYear: '2025-26' }));
    expect(await storage.invoices.nextNumber('2026-10-14')).toBe('2026-27/0008');
    expect(await storage.invoices.nextNumber('2026-03-31')).toBe('2025-26/0100');
    expect(await storage.invoices.nextNumber('2027-04-01')).toBe('2027-28/0001');
  });

  it('uses the prefix from the seller profile', async () => {
    const storage = setup();
    await storage.profile.save(makeSeller({ invoicePrefix: 'INV/' }));
    expect(await storage.invoices.nextNumber('2026-10-14')).toBe('INV/2026-27/0001');
  });
});

describe('themes', () => {
  it('saves, lists and removes custom themes', async () => {
    const storage = setup();
    const custom = createCustomTheme(PRESET_THEMES[1]!, { name: 'Teal', accent: '#0F766E' }, 'custom-1');
    await storage.themes.save(custom);
    expect(await storage.themes.list()).toEqual([custom]);
    await storage.themes.remove('custom-1');
    expect(await storage.themes.list()).toEqual([]);
  });
});

describe('settings', () => {
  it('has defaults and merges updates', async () => {
    const storage = setup();
    expect(await storage.settings.get()).toEqual({ id: 'invoice', defaultThemeId: 'classic', onboarded: false });
    const updated = await storage.settings.update({ onboarded: true, defaultThemeId: 'modern' });
    expect(updated).toEqual({ id: 'invoice', defaultThemeId: 'modern', onboarded: true });
    expect(await storage.settings.get()).toEqual(updated);
    const withBackup = await storage.settings.update({ lastBackupAt: '2026-10-14T12:00:00.000Z' });
    expect(withBackup.onboarded).toBe(true);
    expect(withBackup.lastBackupAt).toBe('2026-10-14T12:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tool-invoice test -- repositories`
Expected: FAIL (cannot resolve `./repositories`).

- [ ] **Step 3: Implement**

`packages/tools/invoice/src/repositories.ts`:
```ts
import { formatInvoiceNumber, indianFiscalYear, nextSequence } from '@solokit/core';
import type { DataStore } from '@solokit/storage';
import { SELLER_ID, SETTINGS_ID, type Client, type InvoiceRecord, type InvoiceSettings, type SellerProfile } from './model';
import { DEFAULT_THEME_ID, type InvoiceTheme } from './themes';

export interface InvoiceStorageOptions {
  now?: () => Date;
}

export interface InvoiceStorage {
  profile: {
    get(): Promise<SellerProfile | undefined>;
    save(profile: SellerProfile): Promise<void>;
  };
  clients: {
    list(): Promise<Client[]>;
    get(id: string): Promise<Client | undefined>;
    save(client: Client): Promise<void>;
    remove(id: string): Promise<void>;
  };
  invoices: {
    list(): Promise<InvoiceRecord[]>;
    get(id: string): Promise<InvoiceRecord | undefined>;
    save(invoice: InvoiceRecord): Promise<InvoiceRecord>;
    remove(id: string): Promise<void>;
    nextNumber(issueDate: string): Promise<string>;
  };
  themes: {
    list(): Promise<InvoiceTheme[]>;
    save(theme: InvoiceTheme): Promise<void>;
    remove(id: string): Promise<void>;
  };
  settings: {
    get(): Promise<InvoiceSettings>;
    update(patch: Partial<Omit<InvoiceSettings, 'id'>>): Promise<InvoiceSettings>;
  };
}

const DEFAULT_SETTINGS: InvoiceSettings = { id: SETTINGS_ID, defaultThemeId: DEFAULT_THEME_ID, onboarded: false };

export function createInvoiceStorage(store: DataStore, options: InvoiceStorageOptions = {}): InvoiceStorage {
  const now = options.now ?? (() => new Date());

  async function listInvoices(): Promise<InvoiceRecord[]> {
    const all = await store.list<InvoiceRecord>('invoices');
    return all.sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number));
  }

  return {
    profile: {
      get: () => store.get<SellerProfile>('profile', SELLER_ID),
      save: (profile) => store.put('profile', { ...profile, id: SELLER_ID }),
    },

    clients: {
      list: async () => {
        const all = await store.list<Client>('clients');
        return all.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
      },
      get: (id) => store.get<Client>('clients', id),
      save: (client) => store.put('clients', client),
      remove: (id) => store.remove('clients', id),
    },

    invoices: {
      list: listInvoices,
      get: (id) => store.get<InvoiceRecord>('invoices', id),
      async save(invoice) {
        const stamp = now().toISOString();
        const saved: InvoiceRecord = { ...invoice, createdAt: invoice.createdAt || stamp, updatedAt: stamp };
        await store.put('invoices', saved);
        return saved;
      },
      remove: (id) => store.remove('invoices', id),
      async nextNumber(issueDate) {
        const [existing, profile] = await Promise.all([listInvoices(), store.get<SellerProfile>('profile', SELLER_ID)]);
        const fiscalYear = indianFiscalYear(issueDate);
        const sequence = nextSequence(
          existing.map((invoice) => invoice.number),
          fiscalYear,
        );
        return formatInvoiceNumber({ prefix: profile?.invoicePrefix ?? '', fiscalYear, sequence });
      },
    },

    themes: {
      list: () => store.list<InvoiceTheme>('themes'),
      save: (theme) => store.put('themes', theme),
      remove: (id) => store.remove('themes', id),
    },

    settings: {
      async get() {
        return (await store.get<InvoiceSettings>('settings', SETTINGS_ID)) ?? { ...DEFAULT_SETTINGS };
      },
      async update(patch) {
        const current = (await store.get<InvoiceSettings>('settings', SETTINGS_ID)) ?? { ...DEFAULT_SETTINGS };
        const next: InvoiceSettings = { ...current, ...patch, id: SETTINGS_ID };
        await store.put('settings', next);
        return next;
      },
    },
  };
}
```

- [ ] **Step 4: Export, run tests and typecheck**

Append to `packages/tools/invoice/src/index.ts`:
```ts
export * from './repositories';
```
Run: `pnpm --filter @solokit/tool-invoice test` then `pnpm --filter @solokit/tool-invoice typecheck`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(invoice): add repositories for profile, clients, invoices, themes and settings

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Backup and restore

**Files:**
- Create: `packages/tools/invoice/src/backup.ts`
- Modify: `src/index.ts`
- Test: `src/backup.test.ts`

**Interfaces:**
- Consumes: `DataStore`, `StorageError` from `@solokit/storage`; `createInvoiceStorage` for the "last backup" setting.
- Produces:
  - `createBackup(store: DataStore, now?: Date): Promise<{ filename: string; json: string }>` (filename `solokit-backup-YYYY-MM-DD.json`; also records `lastBackupAt` in settings)
  - `restoreBackup(store: DataStore, text: string): Promise<void>` (throws `StorageError` for text that is not JSON or not a backup; leaves data unchanged on failure)
  - `isBackupDue(lastBackupAt: string | undefined, now: Date, hasData: boolean, thresholdDays?: number): boolean` (true when there is data and no backup yet, or the last backup is older than the threshold; default 30 days)

- [ ] **Step 1: Write the failing tests**

`packages/tools/invoice/src/backup.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { StorageError, createMemoryStore } from '@solokit/storage';
import { createBackup, isBackupDue, restoreBackup } from './backup';
import { createInvoiceStorage } from './repositories';
import { makeClient, makeInvoice, makeSeller } from './testing';

const NOW = new Date('2026-10-14T12:00:00.000Z');

describe('createBackup', () => {
  it('exports everything as dated JSON and records the backup time', async () => {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => NOW });
    await storage.profile.save(makeSeller());
    await storage.clients.save(makeClient());
    await storage.invoices.save(makeInvoice());

    const backup = await createBackup(store, NOW);
    expect(backup.filename).toBe('solokit-backup-2026-10-14.json');
    const parsed = JSON.parse(backup.json) as { version: number; collections: Record<string, { id: string }[]> };
    expect(parsed.version).toBe(1);
    expect(parsed.collections.invoices?.map((record) => record.id)).toEqual(['inv-1']);
    expect(parsed.collections.profile?.[0]?.id).toBe('me');
    expect((await storage.settings.get()).lastBackupAt).toBe('2026-10-14T12:00:00.000Z');
  });
});

describe('restoreBackup', () => {
  it('restores a backup into another store, replacing what was there', async () => {
    const source = createMemoryStore();
    const sourceStorage = createInvoiceStorage(source, { now: () => NOW });
    await sourceStorage.profile.save(makeSeller({ name: 'From backup' }));
    await sourceStorage.invoices.save(makeInvoice({ id: 'kept' }));
    const { json } = await createBackup(source, NOW);

    const target = createMemoryStore();
    const targetStorage = createInvoiceStorage(target, { now: () => NOW });
    await targetStorage.invoices.save(makeInvoice({ id: 'will-be-replaced' }));
    await restoreBackup(target, json);

    expect((await targetStorage.profile.get())?.name).toBe('From backup');
    expect((await targetStorage.invoices.list()).map((invoice) => invoice.id)).toEqual(['kept']);
  });

  it('rejects text that is not a backup and leaves existing data alone', async () => {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => NOW });
    await storage.invoices.save(makeInvoice({ id: 'keep' }));

    await expect(restoreBackup(store, 'not json at all')).rejects.toBeInstanceOf(StorageError);
    await expect(restoreBackup(store, '{"hello":"world"}')).rejects.toBeInstanceOf(StorageError);
    await expect(restoreBackup(store, '')).rejects.toBeInstanceOf(StorageError);
    expect((await storage.invoices.list()).map((invoice) => invoice.id)).toEqual(['keep']);
  });
});

describe('isBackupDue', () => {
  it('is not due when there is nothing to lose', () => {
    expect(isBackupDue(undefined, NOW, false)).toBe(false);
  });

  it('is due when there is data and no backup yet', () => {
    expect(isBackupDue(undefined, NOW, true)).toBe(true);
  });

  it('is due only after the threshold has passed', () => {
    expect(isBackupDue('2026-10-01T00:00:00.000Z', NOW, true)).toBe(false);
    expect(isBackupDue('2026-09-14T12:00:00.000Z', NOW, true)).toBe(false);
    expect(isBackupDue('2026-09-14T11:59:59.000Z', NOW, true)).toBe(true);
    expect(isBackupDue('2026-10-07T00:00:00.000Z', NOW, true, 3)).toBe(true);
  });

  it('treats an unreadable date as due', () => {
    expect(isBackupDue('garbage', NOW, true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tool-invoice test -- backup`
Expected: FAIL (cannot resolve `./backup`).

- [ ] **Step 3: Implement**

`packages/tools/invoice/src/backup.ts`:
```ts
import { StorageError, type DataStore } from '@solokit/storage';
import { createInvoiceStorage } from './repositories';

export interface BackupFile {
  filename: string;
  json: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Exports everything on this device as one JSON file and remembers when that happened. */
export async function createBackup(store: DataStore, now: Date = new Date()): Promise<BackupFile> {
  const snapshot = await store.exportAll();
  const json = JSON.stringify(snapshot, null, 2);
  await createInvoiceStorage(store, { now: () => now }).settings.update({ lastBackupAt: now.toISOString() });
  return { filename: `solokit-backup-${now.toISOString().slice(0, 10)}.json`, json };
}

/** Replaces everything on this device with the backup. Invalid files change nothing. */
export async function restoreBackup(store: DataStore, text: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new StorageError('This file is not a SoloKit backup (it is not valid JSON)');
  }
  await store.importAll(parsed);
}

/** True when there is data worth protecting and no recent backup. */
export function isBackupDue(lastBackupAt: string | undefined, now: Date, hasData: boolean, thresholdDays = 30): boolean {
  if (!hasData) return false;
  if (lastBackupAt === undefined) return true;
  const last = Date.parse(lastBackupAt);
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > thresholdDays * DAY_MS;
}
```

- [ ] **Step 4: Export, run the whole package suite and typecheck**

Append to `packages/tools/invoice/src/index.ts`:
```ts
export * from './backup';
```
Run: `pnpm --filter @solokit/tool-invoice test`
Expected: PASS (all files).
Run: `pnpm --filter @solokit/tool-invoice typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(invoice): add backup and restore

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Whole-repo verification and README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Mention the package in the README**

In `README.md`, add this line to the Layout list after the `packages/storage` line:
```
- `packages/tools/invoice` the invoice tool's domain logic: data model, validation, document builder, themes, saved data, backup
```
and change the Status "Next" line to:
```
- Next: the invoice PDF engine (Plan 3B) and the invoice screens (Plan 3C).
```

- [ ] **Step 2: Run everything from the root**

Run: `pnpm install`
Expected: exits 0.
Run: `pnpm test`
Expected: every package passes, including `@solokit/tool-invoice`.
Run: `pnpm typecheck`
Expected: no errors in any package.
Run: `pnpm build`
Expected: "Compiled successfully" (the web app does not import the invoice package yet, so this only confirms nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: mention the invoice domain package

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage (this plan's scope):**
- Three seller types, exempt supply bill of supply, proforma title: Tasks 4, 5.
- Consultant features: billing units (Task 1), TDS and advance with net payable (Task 5), export of services in a foreign currency with LUT (Tasks 4, 5), reverse charge (Task 5).
- Seller profile fields incl. GSTIN, PAN, UDYAM, bank, UPI, LUT, prefix, logo as data URL; client; line items with HSN/SAC code: Tasks 1, 2, 6.
- Financial-year invoice numbering with prefix inside 16 characters: Tasks 2 (prefix check), 8 (`nextNumber`).
- UPI QR payload: Task 3 (the QR image itself is Plan 3B).
- Themes: 6 presets, colour-and-font customisation, contrast check, bundled font list: Task 7.
- Saved invoices, clients, seller profile, themes, settings; backup/restore with last-backup tracking: Tasks 8, 9.
- Currencies INR/USD/EUR/GBP: Task 1.
- Out of this plan (Plans 3B and 3C): PDF rendering, font subsetting, QR image, logo resizing, all screens, registry flip, StoreProvider hardening, Geist Mono for the site's amounts, `navigator.storage.persist()`.

**Placeholder scan:** none; every code step has complete code.

**Type consistency:** `SellerProfile`, `Client`, `LineItem`, `InvoiceRecord`, `InvoiceSettings`, `InvoiceTheme`, `Issue`, `InvoiceDocument` and their members are named identically across tasks. `makeSeller`/`makeClient`/`makeInvoice` (Task 1) feed every later test. `calculateGst` input/outputs match Plan 1's final engine (`roundOff` default per mode, `tds`, `advanceReceived`, `reverseCharge`, `exemptSupply`, `isExport`).
