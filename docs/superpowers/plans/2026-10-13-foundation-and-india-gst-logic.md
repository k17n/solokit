# Foundation and India GST Logic Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the SoloKit monorepo and build, fully unit-tested, the pure-logic packages the invoice tool depends on: money arithmetic, amount in words, invoice numbering, GSTIN validation, and the India GST/TDS calculation engine.

**Architecture:** A pnpm-workspaces TypeScript monorepo. `packages/core` holds country-agnostic primitives (integer-paise money, amount in words, financial-year numbering). `packages/tax-engines` holds the `TaxEngine` interface, the country list, and the India engine (`src/in/`). Both packages are plain TypeScript consumed from source (no build step) and tested with Vitest. No UI in this plan.

**Tech Stack:** Node, pnpm workspaces, TypeScript (strict), Vitest.

## Plan roadmap (from the spec)

1. **This plan:** monorepo + core + India GST logic (testable on its own).
2. Plan 2: `storage` (IndexedDB behind an interface), `ui` design system and brand, Next.js static-export app shell, tool registry, PWA, footer. Turborepo is introduced here, when there is more than one build target (the spec lists it; it is deferred as YAGNI until then).
3. Plan 3: the invoice tool: forms, live preview, themes, logo, bundled fonts, PDF, backup/restore.

## Global Constraints

These come from the spec and apply to every task.

- Money is **integer paise**, never floats.
- Monorepo uses **pnpm workspaces** and **TypeScript**.
- Tax rules are **data with an "as of" date**, behind a `TaxEngine` interface; countries are plugins.
- Invoice numbers use a **financial-year series** (e.g. `2026-27/0001`) and stay within the **16-character** GST limit (letters, digits, `/` and `-` only).
- Seller types: **Regular GST** (Tax Invoice; CGST+SGST or IGST), **Composition** (Bill of Supply, no tax collected), **Unregistered** (plain Invoice, no tax), and registered sellers of **exempt supplies** (Bill of Supply).
- Current GST slabs are **0/5/18/40** plus special rates **0.25 and 3**. The engine still accepts legacy **12 and 28**. The reform date is **2025-09-22**.
- TDS is a **user-entered percentage** (10% is the suggested default for professional fees), applied to the value excluding GST.
- Export of services is **zero-rated under LUT** (no tax on the invoice).
- Tests required: tax engine (intra/inter-state, slabs, round-off, reverse charge, export/LUT, TDS), numbering, amount-in-words, GSTIN validation, money arithmetic.
- Amount in words supports the **Indian (lakh/crore)** system for INR and the international system for foreign currencies.

## File Structure

```
.gitignore
package.json                      workspace root scripts
pnpm-workspace.yaml
tsconfig.base.json
README.md
packages/
  core/
    package.json
    tsconfig.json
    src/
      index.ts                    re-exports
      money.ts                    Minor type, parse/format, percentOf, lineAmount, roundToWhole, sum
      money.test.ts
      amount-in-words.ts          amountInWords(minor, currency)
      amount-in-words.test.ts
      numbering.ts                indianFiscalYear, formatInvoiceNumber, nextSequence
      numbering.test.ts
  tax-engines/
    package.json
    tsconfig.json
    src/
      index.ts
      types.ts                    CountryInfo, TaxEngine
      countries.ts                country list (IN available, others coming soon)
      countries.test.ts
      in/
        states.ts                 GST state codes
        states.test.ts
        gstin.ts                  GSTIN validation + checksum
        gstin.test.ts
        rules.ts                  slabs, thresholds, as-of date
        rules.test.ts
        gst.ts                    calculateGst + indiaGstEngine
        gst.test.ts
```

---

### Task 1: Workspace scaffold and money module

**Files:**
- Create: `.gitignore`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`
- Create: `packages/core/src/money.ts`
- Test: `packages/core/src/money.test.ts`

**Interfaces:**
- Produces (`@solokit/core`):
  - `type Minor = number` (integer minor units)
  - `class MoneyError extends Error`
  - `assertMinor(value: number, label?: string): asserts value is Minor`
  - `parseMoney(input: string): Minor | null`
  - `formatMoney(minor: Minor, currency?: string, locale?: string): string` (defaults `'INR'`, `'en-IN'`)
  - `percentOf(amount: Minor, ratePercent: number): Minor` (round half away from zero; rate up to 4 decimals)
  - `lineAmount(quantity: number, unitRate: Minor): Minor` (quantity up to 3 decimals)
  - `roundToWhole(amount: Minor): Minor` (nearest whole rupee, in paise)
  - `sum(values: Minor[]): Minor`

- [ ] **Step 1: Install pnpm**

Run: `npm install -g pnpm`
Then: `pnpm --version`
Expected: prints a version number (9.x or newer).

- [ ] **Step 2: Create the workspace root files**

`.gitignore`:
```
node_modules/
dist/
.next/
out/
coverage/
*.log
.DS_Store
```

`package.json`:
```json
{
  "name": "solokit",
  "private": true,
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

- [ ] **Step 3: Create the core package files**

`packages/core/package.json`:
```json
{
  "name": "@solokit/core",
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
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`packages/core/src/index.ts`:
```ts
export * from './money';
```

- [ ] **Step 4: Write the failing money tests**

`packages/core/src/money.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  MoneyError,
  assertMinor,
  formatMoney,
  lineAmount,
  parseMoney,
  percentOf,
  roundToWhole,
  sum,
} from './money';

describe('assertMinor', () => {
  it('accepts safe integers', () => {
    expect(() => assertMinor(12345)).not.toThrow();
    expect(() => assertMinor(-5)).not.toThrow();
  });

  it('rejects fractions, NaN and unsafe integers', () => {
    expect(() => assertMinor(1.5)).toThrow(MoneyError);
    expect(() => assertMinor(Number.NaN)).toThrow(MoneyError);
    expect(() => assertMinor(2 ** 60)).toThrow(MoneyError);
  });
});

describe('parseMoney', () => {
  it('parses whole and decimal amounts into minor units', () => {
    expect(parseMoney('12')).toBe(1200);
    expect(parseMoney('1234.5')).toBe(123450);
    expect(parseMoney('1234.56')).toBe(123456);
    expect(parseMoney('0.05')).toBe(5);
  });

  it('ignores thousands separators and surrounding spaces', () => {
    expect(parseMoney('1,23,456.78')).toBe(12345678);
    expect(parseMoney(' 12 ')).toBe(1200);
  });

  it('handles negatives and negative zero', () => {
    expect(parseMoney('-5.25')).toBe(-525);
    expect(parseMoney('-0')).toBe(0);
  });

  it('returns null for invalid input', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1.234')).toBeNull();
    expect(parseMoney('.5')).toBeNull();
    expect(parseMoney('5.')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats INR with Indian digit grouping by default', () => {
    expect(formatMoney(12345600)).toBe('₹1,23,456.00');
  });

  it('formats other currencies with a given locale', () => {
    expect(formatMoney(123456, 'USD', 'en-US')).toBe('$1,234.56');
  });
});

describe('percentOf', () => {
  it('computes whole percentages', () => {
    expect(percentOf(10000, 18)).toBe(1800);
  });

  it('rounds half away from zero', () => {
    expect(percentOf(1010, 5)).toBe(51); // 50.5
    expect(percentOf(1010, 2.5)).toBe(25); // 25.25
    expect(percentOf(1, 50)).toBe(1); // 0.5
    expect(percentOf(-1, 50)).toBe(-1); // -0.5
  });

  it('supports up to four decimals in the rate', () => {
    expect(percentOf(1999, 0.125)).toBe(2); // 2.49875
  });

  it('stays exact for very large amounts', () => {
    expect(percentOf(100_000_000_000, 40)).toBe(40_000_000_000);
  });
});

describe('lineAmount', () => {
  it('multiplies fractional quantities exactly', () => {
    expect(lineAmount(7.5, 300000)).toBe(2250000);
    expect(lineAmount(1, 12345)).toBe(12345);
  });

  it('rounds to the nearest paisa', () => {
    expect(lineAmount(1.333, 100)).toBe(133); // 133.3
  });

  it('rejects negative or non-finite quantities', () => {
    expect(() => lineAmount(-1, 100)).toThrow(MoneyError);
    expect(() => lineAmount(Number.NaN, 100)).toThrow(MoneyError);
  });
});

describe('roundToWhole', () => {
  it('rounds to the nearest whole rupee, in paise', () => {
    expect(roundToWhole(12350)).toBe(12400);
    expect(roundToWhole(12349)).toBe(12300);
    expect(roundToWhole(12300)).toBe(12300);
  });
});

describe('sum', () => {
  it('adds minor units', () => {
    expect(sum([100, 250, 5])).toBe(355);
    expect(sum([])).toBe(0);
  });
});
```

- [ ] **Step 5: Install dependencies and run the tests to verify they fail**

Run: `pnpm install`
Then: `pnpm --filter @solokit/core test`
Expected: FAIL. The money tests cannot import `./money` (error such as "Failed to resolve import").

- [ ] **Step 6: Implement the money module**

`packages/core/src/money.ts`:
```ts
/** All money in this codebase is an integer count of minor units (paise, cents). */
export type Minor = number;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function assertMinor(value: number, label = 'amount'): asserts value is Minor {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be a safe integer number of minor units, got ${value}`);
  }
}

const DECIMAL = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/** Parses "1234.5" or "1,23,456.78" into minor units. Returns null for anything else. */
export function parseMoney(input: string): Minor | null {
  const match = DECIMAL.exec(input.trim().replace(/,/g, ''));
  if (!match) return null;
  const [, sign, whole, fraction = ''] = match;
  const minor = Number(whole) * 100 + Number((fraction + '0').slice(0, 2));
  if (!Number.isSafeInteger(minor)) return null;
  if (minor === 0) return 0;
  return sign === '-' ? -minor : minor;
}

/** Display formatting only. Never feed the result back into arithmetic. */
export function formatMoney(minor: Minor, currency = 'INR', locale = 'en-IN'): string {
  assertMinor(minor);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
}

function roundedDiv(numerator: bigint, denominator: bigint): number {
  const negative = numerator < 0n;
  const n = negative ? -numerator : numerator;
  const quotient = n / denominator;
  const remainder = n % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return Number(negative ? -rounded : rounded);
}

/**
 * amount x ratePercent / 100, rounded half away from zero.
 * The rate may have up to four decimals (e.g. 2.5, 0.125). Uses BigInt so large amounts stay exact.
 */
export function percentOf(amount: Minor, ratePercent: number): Minor {
  assertMinor(amount);
  const pips = Math.round(ratePercent * 10_000); // 1 pip = 0.0001 %
  return roundedDiv(BigInt(amount) * BigInt(pips), 1_000_000n);
}

/** quantity (up to three decimals, e.g. 7.5 hours) x unit rate, rounded to the nearest minor unit. */
export function lineAmount(quantity: number, unitRate: Minor): Minor {
  assertMinor(unitRate, 'unitRate');
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new MoneyError(`quantity must be a non-negative number, got ${quantity}`);
  }
  const milli = Math.round(quantity * 1000);
  return roundedDiv(BigInt(milli) * BigInt(unitRate), 1000n);
}

/** Rounds to the nearest whole rupee (100 paise), halves away from zero. */
export function roundToWhole(amount: Minor): Minor {
  assertMinor(amount);
  return roundedDiv(BigInt(amount), 100n) * 100;
}

export function sum(values: Minor[]): Minor {
  return values.reduce((total, value) => total + value, 0);
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @solokit/core test`
Expected: PASS, all money tests green.

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @solokit/core typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold pnpm workspace and add core money module

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Amount in words

**Files:**
- Create: `packages/core/src/amount-in-words.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/amount-in-words.test.ts`

**Interfaces:**
- Consumes: `assertMinor` from `./money`.
- Produces: `amountInWords(minor: Minor, currency?: string): string`. Default currency `'INR'`. Supported: `INR` (Indian numbering), `USD`, `EUR`, `GBP` (international). Throws `RangeError` for negative amounts or unsupported currencies.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/amount-in-words.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { amountInWords } from './amount-in-words';

describe('amountInWords (INR, Indian numbering)', () => {
  it('handles zero', () => {
    expect(amountInWords(0)).toBe('Zero Rupees Only');
  });

  it('uses singular for exactly one', () => {
    expect(amountInWords(100)).toBe('One Rupee Only');
    expect(amountInWords(1)).toBe('One Paisa Only');
  });

  it('speaks paise only when there are no rupees', () => {
    expect(amountInWords(50)).toBe('Fifty Paise Only');
  });

  it('combines rupees and paise', () => {
    expect(amountInWords(123456)).toBe(
      'One Thousand Two Hundred Thirty-Four Rupees and Fifty-Six Paise Only',
    );
  });

  it('uses lakh and crore', () => {
    expect(amountInWords(12345600)).toBe(
      'One Lakh Twenty-Three Thousand Four Hundred Fifty-Six Rupees Only',
    );
    expect(amountInWords(1_000_000_00 * 10)).toBe('One Crore Rupees Only');
    expect(amountInWords(150_000_000 * 100)).toBe('Fifteen Crore Rupees Only');
    expect(amountInWords(1_000_000_000 * 100)).toBe('One Hundred Crore Rupees Only');
  });

  it('handles teens and round tens', () => {
    expect(amountInWords(1900)).toBe('Nineteen Rupees Only');
    expect(amountInWords(7000)).toBe('Seventy Rupees Only');
    expect(amountInWords(10500)).toBe('One Hundred Five Rupees Only');
  });
});

describe('amountInWords (foreign currencies, international numbering)', () => {
  it('formats USD', () => {
    expect(amountInWords(123456, 'USD')).toBe(
      'One Thousand Two Hundred Thirty-Four US Dollars and Fifty-Six Cents Only',
    );
    expect(amountInWords(1_234_567_00, 'USD')).toBe(
      'One Million Two Hundred Thirty-Four Thousand Five Hundred Sixty-Seven US Dollars Only',
    );
  });

  it('formats GBP singular and plural minor units', () => {
    expect(amountInWords(1, 'GBP')).toBe('One Penny Only');
    expect(amountInWords(2, 'GBP')).toBe('Two Pence Only');
  });

  it('formats EUR', () => {
    expect(amountInWords(100, 'EUR')).toBe('One Euro Only');
  });
});

describe('amountInWords errors', () => {
  it('rejects negatives and unsupported currencies', () => {
    expect(() => amountInWords(-1)).toThrow(RangeError);
    expect(() => amountInWords(100, 'XYZ')).toThrow(RangeError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/core test -- amount-in-words`
Expected: FAIL (cannot resolve `./amount-in-words`).

- [ ] **Step 3: Implement**

`packages/core/src/amount-in-words.ts`:
```ts
import { assertMinor, type Minor } from './money';

type Numbering = 'indian' | 'international';

interface CurrencyWords {
  major: readonly [singular: string, plural: string];
  minor: readonly [singular: string, plural: string];
  numbering: Numbering;
}

const CURRENCIES: Record<string, CurrencyWords> = {
  INR: { major: ['Rupee', 'Rupees'], minor: ['Paisa', 'Paise'], numbering: 'indian' },
  USD: { major: ['US Dollar', 'US Dollars'], minor: ['Cent', 'Cents'], numbering: 'international' },
  EUR: { major: ['Euro', 'Euros'], minor: ['Cent', 'Cents'], numbering: 'international' },
  GBP: { major: ['Pound', 'Pounds'], minor: ['Penny', 'Pence'], numbering: 'international' },
};

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const UNITS: Record<Numbering, ReadonlyArray<readonly [size: number, name: string]>> = {
  indian: [[10_000_000, 'Crore'], [100_000, 'Lakh'], [1_000, 'Thousand']],
  international: [[1_000_000_000, 'Billion'], [1_000_000, 'Million'], [1_000, 'Thousand']],
};

function below100(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const tens = TENS[Math.floor(n / 10)] ?? '';
  const ones = ONES[n % 10] ?? '';
  return ones ? `${tens}-${ones}` : tens;
}

function below1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds] ?? ''} Hundred`);
  if (rest) parts.push(below100(rest));
  return parts.join(' ');
}

function integerToWords(n: number, numbering: Numbering): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  let rest = n;
  for (const [size, name] of UNITS[numbering]) {
    const count = Math.floor(rest / size);
    if (count > 0) {
      parts.push(`${integerToWords(count, numbering)} ${name}`);
      rest -= count * size;
    }
  }
  if (rest > 0) parts.push(below1000(rest));
  return parts.join(' ');
}

/** e.g. amountInWords(123456) -> "One Thousand Two Hundred Thirty-Four Rupees and Fifty-Six Paise Only" */
export function amountInWords(minor: Minor, currency = 'INR'): string {
  assertMinor(minor);
  if (minor < 0) throw new RangeError('amountInWords does not support negative amounts');
  const words = CURRENCIES[currency];
  if (!words) throw new RangeError(`Unsupported currency for amount in words: ${currency}`);

  const major = Math.floor(minor / 100);
  const fraction = minor % 100;
  const label = (n: number, names: readonly [string, string]) => (n === 1 ? names[0] : names[1]);

  const parts: string[] = [];
  if (major > 0 || fraction === 0) {
    parts.push(`${integerToWords(major, words.numbering)} ${label(major, words.major)}`);
  }
  if (fraction > 0) {
    parts.push(`${integerToWords(fraction, words.numbering)} ${label(fraction, words.minor)}`);
  }
  return `${parts.join(' and ')} Only`;
}
```

- [ ] **Step 4: Export from the package index**

Append to `packages/core/src/index.ts`:
```ts
export * from './amount-in-words';
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @solokit/core test`
Expected: PASS (money + amount-in-words).
Run: `pnpm --filter @solokit/core typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): add amount in words with Indian and international numbering

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Invoice numbering

**Files:**
- Create: `packages/core/src/numbering.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/numbering.test.ts`

**Interfaces:**
- Produces:
  - `class InvoiceNumberError extends Error`
  - `MAX_INVOICE_NUMBER_LENGTH = 16`
  - `indianFiscalYear(isoDate: string): string` (e.g. `'2026-04-01'` -> `'2026-27'`)
  - `formatInvoiceNumber(parts: { prefix?: string; fiscalYear: string; sequence: number; pad?: number }): string`
  - `nextSequence(existingNumbers: string[], fiscalYear: string): number`

- [ ] **Step 1: Write the failing tests**

`packages/core/src/numbering.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  InvoiceNumberError,
  MAX_INVOICE_NUMBER_LENGTH,
  formatInvoiceNumber,
  indianFiscalYear,
  nextSequence,
} from './numbering';

describe('indianFiscalYear', () => {
  it('starts the year on 1 April', () => {
    expect(indianFiscalYear('2026-04-01')).toBe('2026-27');
    expect(indianFiscalYear('2026-10-13')).toBe('2026-27');
    expect(indianFiscalYear('2027-03-31')).toBe('2026-27');
    expect(indianFiscalYear('2026-03-31')).toBe('2025-26');
    expect(indianFiscalYear('2026-01-15')).toBe('2025-26');
  });

  it('rejects anything that is not an ISO date', () => {
    expect(() => indianFiscalYear('13/10/2026')).toThrow(InvoiceNumberError);
    expect(() => indianFiscalYear('2026-13-01')).toThrow(InvoiceNumberError);
  });
});

describe('formatInvoiceNumber', () => {
  it('builds a padded financial-year number', () => {
    expect(formatInvoiceNumber({ fiscalYear: '2026-27', sequence: 1 })).toBe('2026-27/0001');
    expect(formatInvoiceNumber({ fiscalYear: '2026-27', sequence: 123 })).toBe('2026-27/0123');
  });

  it('supports a prefix and stops at the 16-character GST limit', () => {
    const number = formatInvoiceNumber({ prefix: 'INV/', fiscalYear: '2026-27', sequence: 1 });
    expect(number).toBe('INV/2026-27/0001');
    expect(number).toHaveLength(MAX_INVOICE_NUMBER_LENGTH);
  });

  it('rejects numbers longer than 16 characters', () => {
    expect(() =>
      formatInvoiceNumber({ prefix: 'INVOICE/', fiscalYear: '2026-27', sequence: 1 }),
    ).toThrow(InvoiceNumberError);
    expect(() =>
      formatInvoiceNumber({ fiscalYear: '2026-27', sequence: 1_000_000_000_000 }),
    ).toThrow(InvoiceNumberError);
  });

  it('rejects characters other than letters, digits, slash and hyphen', () => {
    expect(() =>
      formatInvoiceNumber({ prefix: 'A B/', fiscalYear: '2026-27', sequence: 1 }),
    ).toThrow(InvoiceNumberError);
  });

  it('rejects sequences below 1 or non-integers', () => {
    expect(() => formatInvoiceNumber({ fiscalYear: '2026-27', sequence: 0 })).toThrow(InvoiceNumberError);
    expect(() => formatInvoiceNumber({ fiscalYear: '2026-27', sequence: 1.5 })).toThrow(InvoiceNumberError);
  });
});

describe('nextSequence', () => {
  it('starts at 1 when nothing exists', () => {
    expect(nextSequence([], '2026-27')).toBe(1);
  });

  it('continues after the highest number in the same fiscal year', () => {
    expect(nextSequence(['2026-27/0001', '2026-27/0007', '2025-26/0099'], '2026-27')).toBe(8);
  });

  it('ignores prefixes and unrelated numbers', () => {
    expect(nextSequence(['INV/2026-27/0003', 'custom-number'], '2026-27')).toBe(4);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/core test -- numbering`
Expected: FAIL (cannot resolve `./numbering`).

- [ ] **Step 3: Implement**

`packages/core/src/numbering.ts`:
```ts
export class InvoiceNumberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceNumberError';
  }
}

/** GST rule: an invoice number is at most 16 characters of letters, digits, "/" and "-". */
export const MAX_INVOICE_NUMBER_LENGTH = 16;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ALLOWED_CHARACTERS = /^[A-Za-z0-9/-]+$/;
const FISCAL_SEQUENCE = /(\d{4}-\d{2})\/(\d+)$/;

/** Indian financial year label for an ISO date (YYYY-MM-DD): "2026-04-01" -> "2026-27". */
export function indianFiscalYear(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate);
  const month = match ? Number(match[2]) : 0;
  if (!match || month < 1 || month > 12) {
    throw new InvoiceNumberError(`Expected an ISO date (YYYY-MM-DD), got "${isoDate}"`);
  }
  const year = Number(match[1]);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export interface InvoiceNumberParts {
  prefix?: string;
  fiscalYear: string;
  sequence: number;
  pad?: number;
}

export function formatInvoiceNumber({ prefix = '', fiscalYear, sequence, pad = 4 }: InvoiceNumberParts): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new InvoiceNumberError(`Sequence must be a positive integer, got ${sequence}`);
  }
  const number = `${prefix}${fiscalYear}/${String(sequence).padStart(pad, '0')}`;
  if (number.length > MAX_INVOICE_NUMBER_LENGTH) {
    throw new InvoiceNumberError(
      `Invoice number "${number}" is ${number.length} characters; GST allows at most ${MAX_INVOICE_NUMBER_LENGTH}`,
    );
  }
  if (!ALLOWED_CHARACTERS.test(number)) {
    throw new InvoiceNumberError(`Invoice number "${number}" may only contain letters, digits, "/" and "-"`);
  }
  return number;
}

/** The next sequence for a fiscal year, given the invoice numbers already issued. */
export function nextSequence(existingNumbers: string[], fiscalYear: string): number {
  let highest = 0;
  for (const number of existingNumbers) {
    const match = FISCAL_SEQUENCE.exec(number);
    if (match && match[1] === fiscalYear) {
      highest = Math.max(highest, Number(match[2]));
    }
  }
  return highest + 1;
}
```

- [ ] **Step 4: Export from the package index**

Append to `packages/core/src/index.ts`:
```ts
export * from './numbering';
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @solokit/core test`
Expected: PASS (money, amount-in-words, numbering).
Run: `pnpm --filter @solokit/core typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): add financial-year invoice numbering

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: tax-engines package, country list and Indian state codes

**Files:**
- Create: `packages/tax-engines/package.json`, `packages/tax-engines/tsconfig.json`
- Create: `packages/tax-engines/src/index.ts`, `src/types.ts`, `src/countries.ts`, `src/in/states.ts`
- Test: `packages/tax-engines/src/countries.test.ts`, `packages/tax-engines/src/in/states.test.ts`

**Interfaces:**
- Produces:
  - `interface CountryInfo { code: string; name: string; currency: string; status: 'available' | 'coming-soon' }`
  - `interface TaxEngine<TInput, TResult> { country: CountryInfo; rulesAsOf: string; calculate(input: TInput): TResult }`
  - `INDIA: CountryInfo`, `getCountries(): CountryInfo[]`, `getAvailableCountries(): CountryInfo[]`
  - `INDIAN_STATES: ReadonlyArray<{ code: string; name: string }>`, `getStateByCode(code: string)`, `isValidStateCode(code: string): boolean`

- [ ] **Step 1: Create the package files**

`packages/tax-engines/package.json`:
```json
{
  "name": "@solokit/tax-engines",
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
    "@solokit/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/tax-engines/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing tests**

`packages/tax-engines/src/countries.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { INDIA, getAvailableCountries, getCountries } from './countries';

describe('countries', () => {
  it('lists India as available', () => {
    expect(INDIA).toMatchObject({ code: 'IN', currency: 'INR', status: 'available' });
    expect(getAvailableCountries()).toEqual([INDIA]);
  });

  it('lists other countries as coming soon', () => {
    const others = getCountries().filter((country) => country.code !== 'IN');
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((country) => country.status === 'coming-soon')).toBe(true);
  });

  it('has unique country codes', () => {
    const codes = getCountries().map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
```

`packages/tax-engines/src/in/states.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { INDIAN_STATES, getStateByCode, isValidStateCode } from './states';

describe('Indian GST state codes', () => {
  it('maps well-known codes', () => {
    expect(getStateByCode('27')?.name).toBe('Maharashtra');
    expect(getStateByCode('29')?.name).toBe('Karnataka');
    expect(getStateByCode('07')?.name).toBe('Delhi');
    expect(getStateByCode('33')?.name).toBe('Tamil Nadu');
    expect(getStateByCode('36')?.name).toBe('Telangana');
  });

  it('accepts the special codes', () => {
    expect(isValidStateCode('97')).toBe(true);
    expect(isValidStateCode('99')).toBe(true);
  });

  it('rejects unknown codes', () => {
    expect(isValidStateCode('00')).toBe(false);
    expect(isValidStateCode('39')).toBe(false);
    expect(isValidStateCode('7')).toBe(false);
    expect(getStateByCode('00')).toBeUndefined();
  });

  it('has unique codes', () => {
    const codes = INDIAN_STATES.map((state) => state.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.length).toBeGreaterThanOrEqual(38);
  });
});
```

- [ ] **Step 3: Install and run to verify failure**

Run: `pnpm install`
Then: `pnpm --filter @solokit/tax-engines test`
Expected: FAIL (cannot resolve `./countries` and `./states`).

- [ ] **Step 4: Implement types, countries and states**

`packages/tax-engines/src/types.ts`:
```ts
export interface CountryInfo {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  /** ISO 4217 */
  currency: string;
  status: 'available' | 'coming-soon';
}

/** A country's tax rules behind one interface. Countries are plugins. */
export interface TaxEngine<TInput, TResult> {
  country: CountryInfo;
  /** ISO date the bundled rates and thresholds were last verified. */
  rulesAsOf: string;
  calculate(input: TInput): TResult;
}
```

`packages/tax-engines/src/countries.ts`:
```ts
import type { CountryInfo } from './types';

export const INDIA: CountryInfo = { code: 'IN', name: 'India', currency: 'INR', status: 'available' };

const COUNTRIES: readonly CountryInfo[] = [
  INDIA,
  { code: 'US', name: 'United States', currency: 'USD', status: 'coming-soon' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', status: 'coming-soon' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', status: 'coming-soon' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', status: 'coming-soon' },
  { code: 'AU', name: 'Australia', currency: 'AUD', status: 'coming-soon' },
  { code: 'CA', name: 'Canada', currency: 'CAD', status: 'coming-soon' },
];

export function getCountries(): CountryInfo[] {
  return [...COUNTRIES];
}

export function getAvailableCountries(): CountryInfo[] {
  return COUNTRIES.filter((country) => country.status === 'available');
}
```

`packages/tax-engines/src/in/states.ts`:
```ts
export interface IndianState {
  code: string;
  name: string;
}

/**
 * GST state / UT codes, as used in the first two digits of a GSTIN.
 * Codes 25, 26 and 28 are kept because older GSTINs still carry them.
 * Re-verify against the GST portal when updating rules.
 */
export const INDIAN_STATES: readonly IndianState[] = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '25', name: 'Daman and Diu (legacy)' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (before division)' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
  { code: '99', name: 'Centre Jurisdiction' },
];

export function getStateByCode(code: string): IndianState | undefined {
  return INDIAN_STATES.find((state) => state.code === code);
}

export function isValidStateCode(code: string): boolean {
  return getStateByCode(code) !== undefined;
}
```

`packages/tax-engines/src/index.ts`:
```ts
export * from './types';
export * from './countries';
export * from './in/states';
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @solokit/tax-engines test`
Expected: PASS (countries, states).
Run: `pnpm --filter @solokit/tax-engines typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(tax-engines): add package, country list and Indian GST state codes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: GSTIN validation

**Files:**
- Create: `packages/tax-engines/src/in/gstin.ts`
- Modify: `packages/tax-engines/src/index.ts`
- Test: `packages/tax-engines/src/in/gstin.test.ts`

**Interfaces:**
- Consumes: `isValidStateCode` from `./states`.
- Produces:
  - `gstinChecksumChar(first14: string): string`
  - `type GstinValidation = { valid: true; stateCode: string; pan: string } | { valid: false; reason: string }`
  - `validateGstin(input: string): GstinValidation` (trims and upper-cases input)

Reference GSTINs used in the tests (both pass the checksum algorithm): `27AAPFU0939F1ZV` (Maharashtra), `29AAGCB7383J1Z4` (Karnataka).

- [ ] **Step 1: Write the failing tests**

`packages/tax-engines/src/in/gstin.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { gstinChecksumChar, validateGstin } from './gstin';

describe('gstinChecksumChar', () => {
  it('computes the check character', () => {
    expect(gstinChecksumChar('27AAPFU0939F1Z')).toBe('V');
    expect(gstinChecksumChar('29AAGCB7383J1Z')).toBe('4');
  });
});

describe('validateGstin', () => {
  it('accepts valid GSTINs and returns the state and PAN', () => {
    expect(validateGstin('27AAPFU0939F1ZV')).toEqual({
      valid: true,
      stateCode: '27',
      pan: 'AAPFU0939F',
    });
    expect(validateGstin('29AAGCB7383J1Z4')).toEqual({
      valid: true,
      stateCode: '29',
      pan: 'AAGCB7383J',
    });
  });

  it('normalises case and surrounding spaces', () => {
    expect(validateGstin('  27aapfu0939f1zv ').valid).toBe(true);
  });

  it('rejects the wrong shape', () => {
    const result = validateGstin('27AAPFU0939F1Z');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/15 characters/);
  });

  it('rejects an unknown state code', () => {
    const result = validateGstin('00AAPFU0939F1ZV');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/state code/i);
  });

  it('rejects a wrong check character', () => {
    const result = validateGstin('27AAPFU0939F1ZX');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/check character/i);
  });

  it('rejects a missing Z in position 14', () => {
    expect(validateGstin('27AAPFU0939F1AV').valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tax-engines test -- gstin`
Expected: FAIL (cannot resolve `./gstin`).

If the failure instead says it cannot resolve `@solokit/core` or complains about TypeScript syntax in a dependency, that only affects Task 6 onward; note it and continue.

- [ ] **Step 3: Implement**

`packages/tax-engines/src/in/gstin.ts`:
```ts
import { isValidStateCode } from './states';

const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// 2-digit state code, 10-character PAN, entity number, literal "Z", check character
const PATTERN = /^(\d{2})([A-Z]{5}\d{4}[A-Z])([1-9A-Z])Z([0-9A-Z])$/;

/** GSTIN check character: base-36 weighted sum (weights 1,2,1,2,...) over the first 14 characters. */
export function gstinChecksumChar(first14: string): string {
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARSET.indexOf(first14.charAt(i));
    const product = value * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET.charAt((36 - (total % 36)) % 36);
}

export type GstinValidation =
  | { valid: true; stateCode: string; pan: string }
  | { valid: false; reason: string };

export function validateGstin(input: string): GstinValidation {
  const gstin = input.trim().toUpperCase();
  const match = PATTERN.exec(gstin);
  if (!match) {
    return {
      valid: false,
      reason:
        'GSTIN must be 15 characters: 2-digit state code, 10-character PAN, entity number, "Z" and a check character',
    };
  }
  const [, stateCode = '', pan = '', , check = ''] = match;
  if (!isValidStateCode(stateCode)) {
    return { valid: false, reason: `Unknown GST state code "${stateCode}"` };
  }
  if (gstinChecksumChar(gstin.slice(0, 14)) !== check) {
    return { valid: false, reason: 'GSTIN check character does not match' };
  }
  return { valid: true, stateCode, pan };
}
```

- [ ] **Step 4: Export from the package index**

Append to `packages/tax-engines/src/index.ts`:
```ts
export * from './in/gstin';
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @solokit/tax-engines test`
Expected: PASS.
Run: `pnpm --filter @solokit/tax-engines typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(tax-engines): add GSTIN validation with checksum

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: India rules data

**Files:**
- Create: `packages/tax-engines/src/in/rules.ts`
- Modify: `packages/tax-engines/src/index.ts`
- Test: `packages/tax-engines/src/in/rules.test.ts`

**Interfaces:**
- Produces:
  - `IN_RULES_AS_OF: string` (`'2026-10-13'`)
  - `CURRENT_GST_SLABS`, `SPECIAL_GST_RATES`, `LEGACY_GST_SLABS`, `GST_SLAB_REFORM_DATE`
  - `isAllowedGstRate(rate: number): boolean`
  - `isLegacyRateForDate(rate: number, isoDate: string): boolean`
  - `REGISTRATION_THRESHOLDS` (in paise)

- [ ] **Step 1: Write the failing tests**

`packages/tax-engines/src/in/rules.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  CURRENT_GST_SLABS,
  GST_SLAB_REFORM_DATE,
  IN_RULES_AS_OF,
  REGISTRATION_THRESHOLDS,
  isAllowedGstRate,
  isLegacyRateForDate,
} from './rules';

describe('India GST rules data', () => {
  it('records when the rules were last verified', () => {
    expect(IN_RULES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('offers the post-reform slabs', () => {
    expect([...CURRENT_GST_SLABS]).toEqual([0, 5, 18, 40]);
    expect(GST_SLAB_REFORM_DATE).toBe('2025-09-22');
  });

  it('allows current, special and legacy rates but nothing else', () => {
    for (const rate of [0, 0.25, 3, 5, 12, 18, 28, 40]) {
      expect(isAllowedGstRate(rate)).toBe(true);
    }
    for (const rate of [7, -5, 100, 17.5]) {
      expect(isAllowedGstRate(rate)).toBe(false);
    }
  });

  it('flags legacy rates only on or after the reform date', () => {
    expect(isLegacyRateForDate(12, '2025-09-22')).toBe(true);
    expect(isLegacyRateForDate(28, '2026-01-01')).toBe(true);
    expect(isLegacyRateForDate(12, '2025-09-21')).toBe(false);
    expect(isLegacyRateForDate(18, '2026-01-01')).toBe(false);
  });

  it('stores registration thresholds in paise', () => {
    expect(REGISTRATION_THRESHOLDS.services).toBe(2_000_000_00); // Rs 20 lakh
    expect(REGISTRATION_THRESHOLDS.goods).toBe(4_000_000_00); // Rs 40 lakh
    expect(REGISTRATION_THRESHOLDS.servicesSpecialCategory).toBe(1_000_000_00); // Rs 10 lakh
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tax-engines test -- rules`
Expected: FAIL (cannot resolve `./rules`).

- [ ] **Step 3: Implement**

`packages/tax-engines/src/in/rules.ts`:
```ts
/** ISO date the values below were last checked against public sources. Verify with a CA before relying on them. */
export const IN_RULES_AS_OF = '2026-10-13';

/** Slabs the UI offers. 12% and 28% were retired by the GST Council on 2025-09-22. */
export const CURRENT_GST_SLABS = [0, 5, 18, 40] as const;

/** Special rates (e.g. gold, rough diamonds) available as an advanced choice. */
export const SPECIAL_GST_RATES = [0.25, 3] as const;

/** Retired slabs. The engine still accepts them so older invoices can be recreated. */
export const LEGACY_GST_SLABS = [12, 28] as const;

export const GST_SLAB_REFORM_DATE = '2025-09-22';

const ALLOWED_RATES: readonly number[] = [...CURRENT_GST_SLABS, ...SPECIAL_GST_RATES, ...LEGACY_GST_SLABS];

export function isAllowedGstRate(rate: number): boolean {
  return ALLOWED_RATES.includes(rate);
}

/** True when a retired rate is used on an invoice dated on or after the reform (the UI should warn). */
export function isLegacyRateForDate(rate: number, isoDate: string): boolean {
  return (LEGACY_GST_SLABS as readonly number[]).includes(rate) && isoDate >= GST_SLAB_REFORM_DATE;
}

const LAKH = 100_000 * 100; // paise

/** Aggregate-turnover limits above which GST registration is mandatory, in paise. */
export const REGISTRATION_THRESHOLDS = {
  services: 20 * LAKH,
  goods: 40 * LAKH,
  servicesSpecialCategory: 10 * LAKH,
  goodsSpecialCategory: 20 * LAKH,
} as const;
```

- [ ] **Step 4: Export from the package index**

Append to `packages/tax-engines/src/index.ts`:
```ts
export * from './in/rules';
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @solokit/tax-engines test`
Expected: PASS.
Run: `pnpm --filter @solokit/tax-engines typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(tax-engines): add India GST rules data with as-of date

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: GST calculation engine (core)

**Files:**
- Create: `packages/tax-engines/src/in/gst.ts`
- Modify: `packages/tax-engines/src/index.ts`
- Test: `packages/tax-engines/src/in/gst.test.ts`

**Interfaces:**
- Consumes: `lineAmount`, `percentOf`, `roundToWhole`, `sum`, `assertMinor`, `type Minor` from `@solokit/core`; `isValidStateCode` from `./states`; `isAllowedGstRate`, `IN_RULES_AS_OF` from `./rules`; `INDIA`, `TaxEngine` from `../countries`, `../types`.
- Produces (all exported from `./gst`):
  - `type SellerGstStatus = 'regular' | 'composition' | 'unregistered'`
  - `type DocumentType = 'tax-invoice' | 'bill-of-supply' | 'invoice'`
  - `type SupplyMode = 'intra-state' | 'inter-state' | 'export-lut' | 'no-tax'`
  - `type Discount = { kind: 'percent'; percent: number } | { kind: 'amount'; amount: Minor }`
  - `interface GstLineInput { quantity: number; unitRate: Minor; discount?: Discount; gstRate?: number }`
  - `interface GstInput { sellerStatus; sellerStateCode?; placeOfSupplyStateCode?; isExport?; exemptSupply?; lines: GstLineInput[]; roundOff?: boolean }`
  - `interface GstLineResult { gross; discount; taxable; gstRate; cgst; sgst; igst; total }`
  - `interface GstTotals { taxable; cgst; sgst; igst; totalTax; roundOff; grandTotal }`
  - `interface GstResult { mode: SupplyMode; documentType: DocumentType; lines: GstLineResult[]; totals: GstTotals }`
  - `class GstInputError extends Error`
  - `calculateGst(input: GstInput): GstResult`
  - `indiaGstEngine: TaxEngine<GstInput, GstResult>`

Behaviour: unregistered and composition sellers, and registered sellers with `exemptSupply`, collect no tax (`no-tax`). Regular exports are `export-lut` (zero tax). Regular domestic supplies need valid seller and place-of-supply state codes: same state is `intra-state` (CGST + SGST, each half the rate, computed on the taxable value), different is `inter-state` (IGST). `roundOff` defaults to true and rounds the grand total to the nearest rupee.

- [ ] **Step 1: Write the failing tests**

`packages/tax-engines/src/in/gst.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { GstInputError, calculateGst, indiaGstEngine, type GstInput } from './gst';

const intra = (overrides: Partial<GstInput> = {}): GstInput => ({
  sellerStatus: 'regular',
  sellerStateCode: '27',
  placeOfSupplyStateCode: '27',
  lines: [{ quantity: 1, unitRate: 1_000_000, gstRate: 18 }], // Rs 10,000 @ 18%
  ...overrides,
});

describe('calculateGst: regular seller, tax split', () => {
  it('splits intra-state supply into CGST and SGST', () => {
    const result = calculateGst(intra());
    expect(result.mode).toBe('intra-state');
    expect(result.documentType).toBe('tax-invoice');
    expect(result.lines[0]).toMatchObject({
      gross: 1_000_000,
      discount: 0,
      taxable: 1_000_000,
      gstRate: 18,
      cgst: 90_000,
      sgst: 90_000,
      igst: 0,
      total: 1_180_000,
    });
    expect(result.totals).toEqual({
      taxable: 1_000_000,
      cgst: 90_000,
      sgst: 90_000,
      igst: 0,
      totalTax: 180_000,
      roundOff: 0,
      grandTotal: 1_180_000,
    });
  });

  it('charges IGST on inter-state supply', () => {
    const result = calculateGst(intra({ placeOfSupplyStateCode: '29' }));
    expect(result.mode).toBe('inter-state');
    expect(result.totals).toMatchObject({ cgst: 0, sgst: 0, igst: 180_000, grandTotal: 1_180_000 });
  });

  it('keeps CGST equal to SGST when the half-rate leaves odd paise', () => {
    const line = [{ quantity: 1, unitRate: 1010, gstRate: 5 }];
    const same = calculateGst(intra({ lines: line, roundOff: false }));
    expect(same.lines[0]).toMatchObject({ cgst: 25, sgst: 25, igst: 0 });
    const other = calculateGst(intra({ lines: line, placeOfSupplyStateCode: '29', roundOff: false }));
    expect(other.lines[0]).toMatchObject({ cgst: 0, sgst: 0, igst: 51 });
  });

  it('sums several lines, including fractional quantities', () => {
    const result = calculateGst(
      intra({
        placeOfSupplyStateCode: '29',
        lines: [
          { quantity: 2, unitRate: 50_000, gstRate: 18 }, // 1,000.00 -> igst 180.00
          { quantity: 7.5, unitRate: 300_000, gstRate: 18 }, // 22,500.00 -> igst 4,050.00
        ],
      }),
    );
    expect(result.totals).toMatchObject({
      taxable: 2_350_000,
      igst: 423_000,
      totalTax: 423_000,
      roundOff: 0,
      grandTotal: 2_773_000,
    });
  });
});

describe('calculateGst: discounts', () => {
  it('applies a percentage discount before tax', () => {
    const result = calculateGst(
      intra({ lines: [{ quantity: 1, unitRate: 1_000_000, gstRate: 18, discount: { kind: 'percent', percent: 10 } }] }),
    );
    expect(result.lines[0]).toMatchObject({ gross: 1_000_000, discount: 100_000, taxable: 900_000, cgst: 81_000, sgst: 81_000 });
    expect(result.totals.grandTotal).toBe(1_062_000);
  });

  it('applies a fixed discount before tax', () => {
    const result = calculateGst(
      intra({ lines: [{ quantity: 1, unitRate: 1_000_000, gstRate: 18, discount: { kind: 'amount', amount: 50_000 } }] }),
    );
    expect(result.lines[0]).toMatchObject({ discount: 50_000, taxable: 950_000 });
  });

  it('rejects out-of-range discounts', () => {
    const percent = (p: number) => intra({ lines: [{ quantity: 1, unitRate: 1000, gstRate: 18, discount: { kind: 'percent', percent: p } }] });
    expect(() => calculateGst(percent(101))).toThrow(GstInputError);
    expect(() => calculateGst(percent(-1))).toThrow(GstInputError);
    const amount = (a: number) => intra({ lines: [{ quantity: 1, unitRate: 1000, gstRate: 18, discount: { kind: 'amount', amount: a } }] });
    expect(() => calculateGst(amount(1001))).toThrow(GstInputError);
    expect(() => calculateGst(amount(-1))).toThrow(GstInputError);
  });
});

describe('calculateGst: round-off', () => {
  const odd = (roundOff?: boolean) =>
    calculateGst({
      sellerStatus: 'regular',
      sellerStateCode: '27',
      placeOfSupplyStateCode: '29',
      lines: [{ quantity: 1, unitRate: 33_333, gstRate: 18 }], // Rs 333.33 + igst 60.00
      ...(roundOff === undefined ? {} : { roundOff }),
    });

  it('rounds the grand total to the nearest rupee by default', () => {
    const result = odd();
    expect(result.totals).toMatchObject({ igst: 6_000, roundOff: -33, grandTotal: 39_300 });
  });

  it('can be switched off', () => {
    expect(odd(false).totals).toMatchObject({ roundOff: 0, grandTotal: 39_333 });
  });
});

describe('calculateGst: sellers who charge no GST', () => {
  const lines = [{ quantity: 10, unitRate: 50_000 }]; // Rs 5,000

  it('unregistered sellers issue a plain invoice with no tax', () => {
    const result = calculateGst({ sellerStatus: 'unregistered', lines });
    expect(result.mode).toBe('no-tax');
    expect(result.documentType).toBe('invoice');
    expect(result.totals).toMatchObject({ taxable: 500_000, totalTax: 0, grandTotal: 500_000 });
  });

  it('ignores any GST rate supplied for an unregistered seller', () => {
    const result = calculateGst({ sellerStatus: 'unregistered', lines: [{ quantity: 10, unitRate: 50_000, gstRate: 18 }] });
    expect(result.totals.totalTax).toBe(0);
    expect(result.lines[0]?.gstRate).toBe(0);
  });

  it('composition sellers issue a bill of supply with no tax', () => {
    const result = calculateGst({ sellerStatus: 'composition', lines });
    expect(result.mode).toBe('no-tax');
    expect(result.documentType).toBe('bill-of-supply');
    expect(result.totals.grandTotal).toBe(500_000);
  });

  it('registered sellers of exempt supplies issue a bill of supply', () => {
    const result = calculateGst({
      sellerStatus: 'regular',
      sellerStateCode: '27',
      placeOfSupplyStateCode: '27',
      exemptSupply: true,
      lines: [{ quantity: 1, unitRate: 100_000, gstRate: 0 }],
    });
    expect(result.mode).toBe('no-tax');
    expect(result.documentType).toBe('bill-of-supply');
  });
});

describe('calculateGst: export under LUT', () => {
  it('zero-rates an export and needs no place of supply', () => {
    const result = calculateGst({
      sellerStatus: 'regular',
      sellerStateCode: '27',
      isExport: true,
      lines: [{ quantity: 1, unitRate: 100_000, gstRate: 18 }],
    });
    expect(result.mode).toBe('export-lut');
    expect(result.documentType).toBe('tax-invoice');
    expect(result.lines[0]?.gstRate).toBe(0);
    expect(result.totals).toMatchObject({ totalTax: 0, grandTotal: 100_000 });
  });
});

describe('calculateGst: rates', () => {
  it('accepts legacy and special rates', () => {
    expect(() => calculateGst(intra({ lines: [{ quantity: 1, unitRate: 1000, gstRate: 12 }] }))).not.toThrow();
    expect(() => calculateGst(intra({ lines: [{ quantity: 1, unitRate: 1000, gstRate: 0.25 }] }))).not.toThrow();
  });

  it('rejects rates that are not GST rates', () => {
    expect(() => calculateGst(intra({ lines: [{ quantity: 1, unitRate: 1000, gstRate: 7 }] }))).toThrow(GstInputError);
  });

  it('treats a missing rate on a taxable regular supply as 0%', () => {
    const result = calculateGst(intra({ lines: [{ quantity: 1, unitRate: 1000 }] }));
    expect(result.totals.totalTax).toBe(0);
  });
});

describe('calculateGst: state validation', () => {
  it('requires a valid seller state for a regular domestic supply', () => {
    expect(() => calculateGst(intra({ sellerStateCode: undefined }))).toThrow(GstInputError);
    expect(() => calculateGst(intra({ sellerStateCode: '00' }))).toThrow(GstInputError);
  });

  it('requires a valid place of supply for a regular domestic supply', () => {
    expect(() => calculateGst(intra({ placeOfSupplyStateCode: undefined }))).toThrow(GstInputError);
    expect(() => calculateGst(intra({ placeOfSupplyStateCode: '00' }))).toThrow(GstInputError);
  });
});

describe('indiaGstEngine', () => {
  it('exposes the engine contract', () => {
    expect(indiaGstEngine.country.code).toBe('IN');
    expect(indiaGstEngine.rulesAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(indiaGstEngine.calculate(intra()).totals.grandTotal).toBe(1_180_000);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tax-engines test -- gst`
Expected: FAIL (cannot resolve `./gst`).

- [ ] **Step 3: Implement**

`packages/tax-engines/src/in/gst.ts`:
```ts
import { assertMinor, lineAmount, percentOf, roundToWhole, sum, type Minor } from '@solokit/core';
import { INDIA } from '../countries';
import type { TaxEngine } from '../types';
import { IN_RULES_AS_OF, isAllowedGstRate } from './rules';
import { isValidStateCode } from './states';

export type SellerGstStatus = 'regular' | 'composition' | 'unregistered';
export type DocumentType = 'tax-invoice' | 'bill-of-supply' | 'invoice';
export type SupplyMode = 'intra-state' | 'inter-state' | 'export-lut' | 'no-tax';

export type Discount = { kind: 'percent'; percent: number } | { kind: 'amount'; amount: Minor };

export interface GstLineInput {
  quantity: number;
  /** Rate per unit, in paise. */
  unitRate: Minor;
  discount?: Discount;
  /** GST rate in percent. Ignored for sellers who charge no tax; defaults to 0. */
  gstRate?: number;
}

export interface GstInput {
  sellerStatus: SellerGstStatus;
  /** GST state code, required for a regular seller making a domestic supply. */
  sellerStateCode?: string;
  /** GST state code of the place of supply, required for a regular seller making a domestic supply. */
  placeOfSupplyStateCode?: string;
  /** Export of goods/services, zero-rated under LUT. */
  isExport?: boolean;
  /** Registered seller supplying exempt goods/services: issues a bill of supply. */
  exemptSupply?: boolean;
  lines: GstLineInput[];
  /** Round the grand total to the nearest rupee. Defaults to true. */
  roundOff?: boolean;
}

export interface GstLineResult {
  gross: Minor;
  discount: Minor;
  taxable: Minor;
  /** The rate actually applied (0 when no tax is charged). */
  gstRate: number;
  cgst: Minor;
  sgst: Minor;
  igst: Minor;
  total: Minor;
}

export interface GstTotals {
  taxable: Minor;
  cgst: Minor;
  sgst: Minor;
  igst: Minor;
  totalTax: Minor;
  roundOff: Minor;
  grandTotal: Minor;
}

export interface GstResult {
  mode: SupplyMode;
  documentType: DocumentType;
  lines: GstLineResult[];
  totals: GstTotals;
}

export class GstInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GstInputError';
  }
}

function resolveMode(input: GstInput): SupplyMode {
  if (input.sellerStatus !== 'regular' || input.exemptSupply) return 'no-tax';
  if (input.isExport) return 'export-lut';
  const seller = input.sellerStateCode;
  const supply = input.placeOfSupplyStateCode;
  if (!seller || !isValidStateCode(seller)) {
    throw new GstInputError('Seller state code is required and must be a valid GST state code');
  }
  if (!supply || !isValidStateCode(supply)) {
    throw new GstInputError('Place of supply is required and must be a valid GST state code');
  }
  return seller === supply ? 'intra-state' : 'inter-state';
}

function documentTypeFor(input: GstInput): DocumentType {
  if (input.sellerStatus === 'unregistered') return 'invoice';
  if (input.sellerStatus === 'composition' || input.exemptSupply) return 'bill-of-supply';
  return 'tax-invoice';
}

function discountFor(gross: Minor, discount: Discount | undefined): Minor {
  if (!discount) return 0;
  if (discount.kind === 'percent') {
    if (discount.percent < 0 || discount.percent > 100) {
      throw new GstInputError('Discount percent must be between 0 and 100');
    }
    return percentOf(gross, discount.percent);
  }
  assertMinor(discount.amount, 'discount amount');
  if (discount.amount < 0 || discount.amount > gross) {
    throw new GstInputError('Discount amount must be between 0 and the line amount');
  }
  return discount.amount;
}

function calculateLine(line: GstLineInput, mode: SupplyMode): GstLineResult {
  const taxed = mode === 'intra-state' || mode === 'inter-state';
  const gstRate = taxed ? (line.gstRate ?? 0) : 0;
  if (taxed && !isAllowedGstRate(gstRate)) {
    throw new GstInputError(`${gstRate}% is not a valid GST rate`);
  }
  const gross = lineAmount(line.quantity, line.unitRate);
  const discount = discountFor(gross, line.discount);
  const taxable = gross - discount;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (mode === 'intra-state') {
    cgst = percentOf(taxable, gstRate / 2);
    sgst = cgst;
  } else if (mode === 'inter-state') {
    igst = percentOf(taxable, gstRate);
  }
  return { gross, discount, taxable, gstRate, cgst, sgst, igst, total: taxable + cgst + sgst + igst };
}

export function calculateGst(input: GstInput): GstResult {
  const mode = resolveMode(input);
  const lines = input.lines.map((line) => calculateLine(line, mode));

  const taxable = sum(lines.map((line) => line.taxable));
  const cgst = sum(lines.map((line) => line.cgst));
  const sgst = sum(lines.map((line) => line.sgst));
  const igst = sum(lines.map((line) => line.igst));
  const totalTax = cgst + sgst + igst;

  const beforeRounding = taxable + totalTax;
  const roundOff = (input.roundOff ?? true) ? roundToWhole(beforeRounding) - beforeRounding : 0;

  return {
    mode,
    documentType: documentTypeFor(input),
    lines,
    totals: { taxable, cgst, sgst, igst, totalTax, roundOff, grandTotal: beforeRounding + roundOff },
  };
}

export const indiaGstEngine: TaxEngine<GstInput, GstResult> = {
  country: INDIA,
  rulesAsOf: IN_RULES_AS_OF,
  calculate: calculateGst,
};
```

- [ ] **Step 4: Export from the package index**

Append to `packages/tax-engines/src/index.ts`:
```ts
export * from './in/gst';
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @solokit/tax-engines test`
Expected: PASS.

If Vitest fails to import `@solokit/core` (for example "Unexpected token" on TypeScript syntax from the linked package), create `packages/tax-engines/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { server: { deps: { inline: ['@solokit/core'] } } },
});
```
and re-run.

Run: `pnpm --filter @solokit/tax-engines typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(tax-engines): add India GST calculation engine

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Reverse charge, TDS and advances

**Files:**
- Modify: `packages/tax-engines/src/in/gst.ts`
- Modify (tests): `packages/tax-engines/src/in/gst.test.ts`

**Interfaces:**
- Adds to `GstInput`: `reverseCharge?: boolean`, `tds?: { ratePercent: number }`, `advanceReceived?: Minor`
- Adds to `GstResult`: `reverseCharge: boolean`, `tds: Minor`, `advance: Minor`, `netPayable: Minor`

Behaviour:
- **Reverse charge** applies only to taxed supplies (`intra-state` / `inter-state`). Tax is still computed and shown, but the recipient pays it, so it is excluded from the grand total. For any other mode the result reports `reverseCharge: false`.
- **TDS** is `ratePercent` of the **taxable value** (excluding GST), allowed range 0 to 100.
- **Advance** must be between 0 and the grand total.
- `netPayable = grandTotal - tds - advance`.

- [ ] **Step 1: Add the failing tests**

Append to `packages/tax-engines/src/in/gst.test.ts` (the `intra` helper already exists at the top of the file):
```ts
describe('calculateGst: reverse charge', () => {
  it('shows the tax but leaves it out of the amount payable to the supplier', () => {
    const result = calculateGst(intra({ reverseCharge: true }));
    expect(result.reverseCharge).toBe(true);
    expect(result.totals).toMatchObject({ cgst: 90_000, sgst: 90_000, totalTax: 180_000, grandTotal: 1_000_000 });
    expect(result.netPayable).toBe(1_000_000);
  });

  it('is ignored when no tax is charged', () => {
    const result = calculateGst({ sellerStatus: 'unregistered', reverseCharge: true, lines: [{ quantity: 1, unitRate: 1000 }] });
    expect(result.reverseCharge).toBe(false);
  });

  it('defaults to off', () => {
    expect(calculateGst(intra()).reverseCharge).toBe(false);
  });
});

describe('calculateGst: TDS and advances', () => {
  it('defaults to no TDS and no advance', () => {
    const result = calculateGst(intra());
    expect(result).toMatchObject({ tds: 0, advance: 0, netPayable: 1_180_000 });
  });

  it('deducts TDS on the value excluding GST', () => {
    const result = calculateGst(intra({ tds: { ratePercent: 10 } }));
    expect(result.tds).toBe(100_000);
    expect(result.totals.grandTotal).toBe(1_180_000);
    expect(result.netPayable).toBe(1_080_000);
  });

  it('supports TDS for unregistered consultants', () => {
    const result = calculateGst({
      sellerStatus: 'unregistered',
      lines: [{ quantity: 10, unitRate: 50_000 }],
      tds: { ratePercent: 10 },
    });
    expect(result.tds).toBe(50_000);
    expect(result.netPayable).toBe(450_000);
  });

  it('subtracts an advance already received', () => {
    const result = calculateGst(intra({ advanceReceived: 300_000 }));
    expect(result.advance).toBe(300_000);
    expect(result.netPayable).toBe(880_000);
  });

  it('combines TDS and an advance', () => {
    const result = calculateGst(intra({ tds: { ratePercent: 10 }, advanceReceived: 300_000 }));
    expect(result.netPayable).toBe(780_000);
  });

  it('rejects an invalid TDS rate', () => {
    expect(() => calculateGst(intra({ tds: { ratePercent: -1 } }))).toThrow(GstInputError);
    expect(() => calculateGst(intra({ tds: { ratePercent: 101 } }))).toThrow(GstInputError);
  });

  it('rejects an advance that is negative or exceeds the invoice total', () => {
    expect(() => calculateGst(intra({ advanceReceived: -1 }))).toThrow(GstInputError);
    expect(() => calculateGst(intra({ advanceReceived: 1_180_001 }))).toThrow(GstInputError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tax-engines test -- gst`
Expected: FAIL. The new tests fail on missing `reverseCharge`, `tds`, `advance` and `netPayable` (and typecheck errors for the new input fields).

- [ ] **Step 3: Extend the input and result types in `gst.ts`**

In `packages/tax-engines/src/in/gst.ts`, add these fields to `GstInput`, after `roundOff`:
```ts
  /** Reverse charge: tax is shown but paid by the recipient, so it is left out of the grand total. */
  reverseCharge?: boolean;
  /** Tax deducted at source by the client, as a percent of the value excluding GST. */
  tds?: { ratePercent: number };
  /** Advance already received against this invoice, in paise. */
  advanceReceived?: Minor;
```

and replace the `GstResult` interface with:
```ts
export interface GstResult {
  mode: SupplyMode;
  documentType: DocumentType;
  lines: GstLineResult[];
  totals: GstTotals;
  reverseCharge: boolean;
  /** TDS the client is expected to deduct. */
  tds: Minor;
  advance: Minor;
  /** grandTotal - tds - advance: what should actually arrive. */
  netPayable: Minor;
}
```

- [ ] **Step 4: Replace `calculateGst` in `gst.ts`**

Replace the whole `calculateGst` function with:
```ts
export function calculateGst(input: GstInput): GstResult {
  const mode = resolveMode(input);
  const lines = input.lines.map((line) => calculateLine(line, mode));

  const taxable = sum(lines.map((line) => line.taxable));
  const cgst = sum(lines.map((line) => line.cgst));
  const sgst = sum(lines.map((line) => line.sgst));
  const igst = sum(lines.map((line) => line.igst));
  const totalTax = cgst + sgst + igst;

  const reverseCharge = Boolean(input.reverseCharge) && (mode === 'intra-state' || mode === 'inter-state');
  const payableTax = reverseCharge ? 0 : totalTax;

  const beforeRounding = taxable + payableTax;
  const roundOff = (input.roundOff ?? true) ? roundToWhole(beforeRounding) - beforeRounding : 0;
  const grandTotal = beforeRounding + roundOff;

  const tds = tdsFor(taxable, input.tds);
  const advance = advanceFor(grandTotal, input.advanceReceived);

  return {
    mode,
    documentType: documentTypeFor(input),
    lines,
    totals: { taxable, cgst, sgst, igst, totalTax, roundOff, grandTotal },
    reverseCharge,
    tds,
    advance,
    netPayable: grandTotal - tds - advance,
  };
}
```

and add these two helpers above `calculateGst`:
```ts
function tdsFor(taxable: Minor, tds: GstInput['tds']): Minor {
  if (!tds) return 0;
  if (tds.ratePercent < 0 || tds.ratePercent > 100) {
    throw new GstInputError('TDS rate must be between 0 and 100');
  }
  return percentOf(taxable, tds.ratePercent);
}

function advanceFor(grandTotal: Minor, advance: Minor | undefined): Minor {
  if (advance === undefined) return 0;
  assertMinor(advance, 'advance');
  if (advance < 0 || advance > grandTotal) {
    throw new GstInputError('Advance must be between 0 and the invoice total');
  }
  return advance;
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @solokit/tax-engines test`
Expected: PASS (all gst tests, old and new).
Run: `pnpm --filter @solokit/tax-engines typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(tax-engines): add reverse charge, TDS and advances to GST engine

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: README and full verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

`README.md`:
```markdown
# SoloKit

Free, local-first tools for freelancers, consultants and solopreneurs. Everything runs in the browser, works offline, and keeps your data on your device. India (GST) comes first; other countries are coming soon.

## Status

- Done: monorepo, money/numbering/amount-in-words primitives, India GST/TDS engine.
- Next: storage, design system and app shell, then the invoice generator UI.

## Layout

- `packages/core` country-agnostic primitives (integer-paise money, amount in words, invoice numbering)
- `packages/tax-engines` `TaxEngine` interface, country list, India GST engine
- `docs/ideas.md` backlog of tool ideas
- `docs/superpowers/specs` design specs
- `docs/superpowers/plans` implementation plans

## Develop

    npm install -g pnpm
    pnpm install
    pnpm test
    pnpm typecheck

Tax rates and thresholds are data (`packages/tax-engines/src/in/rules.ts`) with an "as of" date. They are not tax advice; verify with a chartered accountant.
```

- [ ] **Step 2: Run the whole test suite and typecheck from the root**

Run: `pnpm test`
Expected: PASS for `@solokit/core` and `@solokit/tax-engines`, no failures.
Run: `pnpm typecheck`
Expected: no errors in either package.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: add README

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage (for this plan's scope):**
- Monorepo with pnpm workspaces, TypeScript: Task 1. Turborepo deferred to Plan 2 (stated in the roadmap).
- Integer-paise money: Task 1.
- Amount in words, Indian and international: Task 2.
- Financial-year numbering within 16 characters: Task 3.
- `TaxEngine` interface, countries plugin, "coming soon" list: Task 4.
- State codes, GSTIN validation: Tasks 4 and 5.
- Rules as data with as-of date, current/legacy slabs, thresholds: Task 6.
- CGST/SGST vs IGST, discounts, round-off, three seller types, exempt bill of supply, export under LUT: Task 7.
- Reverse charge, TDS, advances / milestones (advance part): Task 8.
- Out of this plan, covered by Plans 2 and 3: storage, UI, brand, themes, logo, fonts, PDF, PWA, backup, billing units in the UI, milestone UI, HSN/SAC list, UPI QR, Playwright and Lighthouse checks.

**Placeholder scan:** none; every code step has complete code.

**Type consistency:** `Minor`, `GstInput`, `GstResult`, `GstInputError`, `calculateGst`, `indiaGstEngine`, `isValidStateCode`, `isAllowedGstRate` are named identically wherever used. Task 8 extends `GstInput` and `GstResult` defined in Task 7 and replaces `calculateGst` wholesale.
