# Invoice Editor Implementation Plan (Plan 3C-2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let people create invoices: pick or enter a client, add line items, choose supply options (export, place of supply, reverse charge, TDS, advance), see live totals and a live PDF preview, save drafts, issue invoices, download the PDF, and manage a list of invoices (open, duplicate, cancel, delete drafts). Flip the invoice tool to "available" in the registry.

**Architecture:** Everything lives in `apps/web/src/invoice/`. Pure modules hold the logic and are tested on their own: input parsing (`inputs.ts`), the client form (`clientFormState.ts`), and the editor model (`editorModel.ts`: form state to `InvoiceRecord`, validation, duplication). React components are small and controlled: `ClientSection`, `LineItemsEditor`, `DetailsSection`, `TotalsPanel`, `PdfPreview` (with the `usePdfPreview` hook), and the screens `InvoiceEditor`, `InvoiceList`, `InvoiceViewer`. The PDF package is imported dynamically only when a preview or download is needed (`await import('@solokit/tool-invoice-pdf')`), so nothing heavy loads with the page. Components take the PDF renderer as an optional prop so tests never run react-pdf in jsdom; the browser tests (Playwright with the installed Chrome) exercise the real thing end to end.

**Tech Stack:** React 19, Next.js 16 static export, `@solokit/tool-invoice` (domain), `@solokit/tool-invoice-pdf`, Vitest + Testing Library, Playwright.

## Plan roadmap

1. Plans 3A, 3B, 3C-1 (merged).
2. **Plan 3C-2 (this plan):** invoice editor, preview, issue and download, list, registry flip.
3. Plan 3C-3: theme picker and editor, backup and restore UI, dark-scheme and mobile polish, offline end-to-end.

## Global Constraints

- Money is integer paise; amounts typed by people are parsed with `parseMoney` (rupees or other currency units with up to two decimals); quantities have at most three decimals and are at least 0.001; percentages are 0 to 100.
- Domestic invoices are always in INR. The currency choice appears only for exports (INR, USD, EUR, GBP). An export has no place of supply, no state for the client, a free-text country, and no GST columns.
- GST columns, "GST rate" per line, "Place of supply", "Reverse charge" appear only when GST applies: the seller is Regular, the invoice is not an export, and it is not an exempt supply. "Exempt supply" appears only for Regular sellers.
- Current GST slabs are offered (0, 5, 18, 40 and the special 0.25 and 3). The old 12% and 28% appear only when the invoice date is before 2025-09-22 or when a line already uses one; a line using one on an invoice dated on or after that day shows a warning.
- Issued invoices are never deleted: they can be cancelled (the number stays used). Only drafts can be deleted or edited. Editing an issued invoice is not offered; "Duplicate as new draft" is.
- The SAC code suggestions are a short unverified list (`COMMON_SERVICE_CODES`): the form says so and accepts any code.
- A new invoice gets the next number for its financial year automatically (`storage.invoices.nextNumber(issueDate)`); changing the issue date across 1 April renumbers it unless the number was typed by hand. An existing draft keeps its number.
- Issuing validates everything (`validateEditor`), then `issueInvoice`, then saves; a duplicate number is reported on the number field. Saving a draft only needs the typed numbers to be parseable.
- Previews and downloads need a valid invoice. The PDF library is loaded on demand; a failed load shows a plain message and a "Try again" button.
- Accessibility: same rules as Plan 3C-1 (labels, `role="alert"` errors, focus on first invalid field on a failed issue, `noValidate`). Item groups are `fieldset`s with a legend ("Item 1"). Destructive actions use two-step inline confirmation (no `window.confirm`).
- Navigation of the tool uses plain buttons with `aria-current="page"` inside `<nav aria-label="Invoice tool">` (not ARIA tabs).
- Never name two files in `apps/web/src/invoice/` that differ only by case (Windows file system).

## File Structure

```
apps/web/src/invoice/
  ids.ts                                  newId()
  inputs.ts            inputs.test.ts
  clientFormState.ts   clientFormState.test.ts
  editorModel.ts       editorModel.test.ts
  ClientSection.tsx    ClientSection.test.tsx
  LineItemsEditor.tsx  LineItemsEditor.test.tsx   LineItemsEditor.module.css
  DetailsSection.tsx   DetailsSection.test.tsx
  TotalsPanel.tsx      TotalsPanel.test.tsx
  usePdfPreview.ts     PdfPreview.tsx   PdfPreview.test.tsx   (hook tested through the component)
  downloads.ts         downloads.test.ts
  InvoiceEditor.tsx    InvoiceEditor.test.tsx   InvoiceEditor.module.css
  InvoiceList.tsx      InvoiceList.test.tsx     InvoiceList.module.css
  InvoiceViewer.tsx    InvoiceViewer.test.tsx
  InvoiceApp.tsx       InvoiceApp.test.tsx      (modify)
apps/web/e2e/invoice.spec.ts
packages/registry/src/tools.ts  tools.test.ts   (modify)
apps/web/src/components/home.test.tsx            (modify)
```

---

### Task 1: Input parsing helpers

**Files:**
- Create: `apps/web/src/invoice/ids.ts`, `inputs.ts`
- Test: `apps/web/src/invoice/inputs.test.ts`

**Interfaces:**
- Produces:
  - `newId(): string` (`crypto.randomUUID()` when available, otherwise a random fallback)
  - `parseAmountInput(text: string): Minor | null`, `formatAmountInput(minor: Minor): string`
  - `parseQuantityInput(text: string): number | null`, `formatQuantityInput(quantity: number): string`
  - `parsePercentInput(text: string): number | null`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/invoice/inputs.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { newId } from './ids';
import {
  formatAmountInput,
  formatQuantityInput,
  parseAmountInput,
  parsePercentInput,
  parseQuantityInput,
} from './inputs';

describe('parseAmountInput', () => {
  it('turns typed amounts into minor units', () => {
    expect(parseAmountInput('3000')).toBe(300000);
    expect(parseAmountInput('3,000.50')).toBe(300050);
    expect(parseAmountInput(' 1,23,456.7 ')).toBe(12345670);
    expect(parseAmountInput('0')).toBe(0);
    expect(parseAmountInput('0.05')).toBe(5);
  });

  it('rejects empty, negative, text and more than two decimals', () => {
    for (const text of ['', '  ', '-5', 'abc', '1.234', '1e5', '.5', '5.']) {
      expect(parseAmountInput(text), text).toBeNull();
    }
  });
});

describe('formatAmountInput', () => {
  it('writes whole amounts without decimals and others with two', () => {
    expect(formatAmountInput(300000)).toBe('3000');
    expect(formatAmountInput(300050)).toBe('3000.50');
    expect(formatAmountInput(5)).toBe('0.05');
    expect(formatAmountInput(0)).toBe('0');
  });

  it('round-trips through the parser', () => {
    for (const minor of [0, 1, 99, 100, 123456, 987654321]) {
      expect(parseAmountInput(formatAmountInput(minor))).toBe(minor);
    }
  });
});

describe('parseQuantityInput', () => {
  it('accepts positive numbers with up to three decimals', () => {
    expect(parseQuantityInput('1')).toBe(1);
    expect(parseQuantityInput('7.5')).toBe(7.5);
    expect(parseQuantityInput('0.001')).toBe(0.001);
    expect(parseQuantityInput('1,000')).toBe(1000);
  });

  it('rejects zero, too many decimals, negatives and text', () => {
    for (const text of ['', '0', '0.0004', '1.2345', '-1', 'x', '1e3']) {
      expect(parseQuantityInput(text), text).toBeNull();
    }
  });
});

describe('formatQuantityInput', () => {
  it('trims trailing zeros', () => {
    expect(formatQuantityInput(24)).toBe('24');
    expect(formatQuantityInput(7.5)).toBe('7.5');
    expect(formatQuantityInput(1.235)).toBe('1.235');
  });
});

describe('parsePercentInput', () => {
  it('accepts 0 to 100 with up to four decimals', () => {
    expect(parsePercentInput('10')).toBe(10);
    expect(parsePercentInput('2.5')).toBe(2.5);
    expect(parsePercentInput('0')).toBe(0);
    expect(parsePercentInput('100')).toBe(100);
    expect(parsePercentInput('0.0001')).toBe(0.0001);
  });

  it('rejects out-of-range and malformed input', () => {
    for (const text of ['', '-1', '100.1', '101', 'ten', '1.23456', '5%']) {
      expect(parsePercentInput(text), text).toBeNull();
    }
  });
});

describe('newId', () => {
  it('gives different, non-empty ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id.length).toBeGreaterThan(8);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- inputs`
Expected: FAIL (cannot resolve `./inputs` and `./ids`).

- [ ] **Step 3: Implement**

`apps/web/src/invoice/ids.ts`:
```ts
/** A unique id for a new record. Uses the browser's UUID generator when there is one. */
export function newId(): string {
  const generator = globalThis.crypto;
  if (generator && typeof generator.randomUUID === 'function') return generator.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```

`apps/web/src/invoice/inputs.ts`:
```ts
import { parseMoney, type Minor } from '@solokit/core';

/** "3,000.50" -> 300050. Null for empty, negative, or more than two decimals. */
export function parseAmountInput(text: string): Minor | null {
  const minor = parseMoney(text);
  return minor === null || minor < 0 ? null : minor;
}

/** 300050 -> "3000.50", 300000 -> "3000". For filling an input from a saved amount. */
export function formatAmountInput(minor: Minor): string {
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0')}`;
}

/** A quantity of at least 0.001 with at most three decimals. */
export function parseQuantityInput(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value >= 0.001 ? value : null;
}

export function formatQuantityInput(quantity: number): string {
  return Number(quantity.toFixed(3)).toString();
}

/** 0 to 100 with up to four decimals. */
export function parsePercentInput(text: string): number | null {
  const cleaned = text.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value <= 100 ? value : null;
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @solokit/web test -- inputs`
Expected: PASS.
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): add input parsing helpers for amounts, quantities and percentages

```

---

### Task 2: Client form state

**Files:**
- Create: `apps/web/src/invoice/clientFormState.ts`
- Test: `apps/web/src/invoice/clientFormState.test.ts`

**Interfaces:**
- Produces:
  - `interface ClientFormState { name; gstin; pan; line1; line2; city; postalCode; stateCode; country; email; phone }` (all strings)
  - `emptyClientForm(): ClientFormState` (country `'India'`)
  - `clientToForm(client: Client): ClientFormState`
  - `formToClient(form: ClientFormState, id: string): Client` (normalised with `normaliseClient`)
  - `validateClientForm(form: ClientFormState): Issue[]`: `validateClient` plus the client's address line 1 and city are required (`address.line1`, `address.city`)
  - `applyClientGstin(form: ClientFormState, gstin: string): ClientFormState` (upper-case; fills `stateCode` and sets country `'India'` when the GSTIN is valid)
  - `isBlankClient(form: ClientFormState): boolean` (name, address line 1 and city all empty)

- [ ] **Step 1: Write the failing tests**

`apps/web/src/invoice/clientFormState.test.ts`:
```ts
import { makeClient } from '@solokit/tool-invoice/testing';
import { describe, expect, it } from 'vitest';
import {
  applyClientGstin,
  clientToForm,
  emptyClientForm,
  formToClient,
  isBlankClient,
  validateClientForm,
  type ClientFormState,
} from './clientFormState';

const filled = (overrides: Partial<ClientFormState> = {}): ClientFormState => ({
  ...emptyClientForm(),
  name: '  Northwind Traders ',
  gstin: '27aabct3518q1zw',
  line1: '4 MG Road',
  city: 'Pune',
  postalCode: '411001',
  stateCode: '27',
  email: 'Accounts@Northwind.example ',
  ...overrides,
});

describe('emptyClientForm', () => {
  it('starts blank and in India', () => {
    const form = emptyClientForm();
    expect(form.country).toBe('India');
    expect(form.name).toBe('');
    expect(isBlankClient(form)).toBe(true);
  });
});

describe('formToClient', () => {
  it('normalises what was typed and keeps the id', () => {
    const client = formToClient(filled(), 'client-9');
    expect(client).toMatchObject({
      id: 'client-9',
      name: 'Northwind Traders',
      gstin: '27AABCT3518Q1ZW',
      email: 'accounts@northwind.example',
      address: { line1: '4 MG Road', city: 'Pune', postalCode: '411001', stateCode: '27', country: 'India' },
    });
    expect('line2' in client.address).toBe(false);
    expect('phone' in client).toBe(false);
  });

  it('round-trips a saved client', () => {
    const saved = makeClient();
    expect(formToClient(clientToForm(saved), saved.id)).toEqual(saved);
  });
});

describe('validateClientForm', () => {
  it('accepts a complete domestic client', () => {
    expect(validateClientForm(filled())).toEqual([]);
  });

  it('accepts a foreign client without a GSTIN or state', () => {
    const form = filled({ gstin: '', stateCode: '', country: 'United States', city: 'Austin', line1: '1 Main St' });
    expect(validateClientForm(form)).toEqual([]);
  });

  it('asks for the name, address line 1 and city', () => {
    const paths = validateClientForm(emptyClientForm()).map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'address.line1', 'address.city']));
  });

  it('checks the GSTIN and email', () => {
    const paths = validateClientForm(filled({ gstin: '27AABCT3518Q1ZX', email: 'nope' })).map((issue) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['gstin', 'email']));
  });
});

describe('applyClientGstin', () => {
  it('upper-cases the typed GSTIN', () => {
    expect(applyClientGstin(emptyClientForm(), ' 27aab ').gstin).toBe('27AAB');
  });

  it('fills the state and India from a valid GSTIN only', () => {
    const valid = applyClientGstin({ ...emptyClientForm(), country: 'France' }, '29AAGCB7383J1Z4');
    expect(valid.stateCode).toBe('29');
    expect(valid.country).toBe('India');
    const partial = applyClientGstin({ ...emptyClientForm(), stateCode: '07' }, '29AAGC');
    expect(partial.stateCode).toBe('07');
  });
});

describe('isBlankClient', () => {
  it('is blank only when name, address line 1 and city are all empty', () => {
    expect(isBlankClient({ ...emptyClientForm(), email: 'x@y.z' })).toBe(true);
    expect(isBlankClient({ ...emptyClientForm(), name: 'A' })).toBe(false);
    expect(isBlankClient({ ...emptyClientForm(), city: 'Pune' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- clientFormState`
Expected: FAIL (cannot resolve `./clientFormState`).

- [ ] **Step 3: Implement**

`apps/web/src/invoice/clientFormState.ts`:
```ts
import { validateGstin } from '@solokit/tax-engines';
import { normaliseClient, validateClient, type Client, type Issue } from '@solokit/tool-invoice';

export interface ClientFormState {
  name: string;
  gstin: string;
  pan: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  stateCode: string;
  country: string;
  email: string;
  phone: string;
}

export function emptyClientForm(): ClientFormState {
  return {
    name: '',
    gstin: '',
    pan: '',
    line1: '',
    line2: '',
    city: '',
    postalCode: '',
    stateCode: '',
    country: 'India',
    email: '',
    phone: '',
  };
}

export function clientToForm(client: Client): ClientFormState {
  return {
    name: client.name,
    gstin: client.gstin ?? '',
    pan: client.pan ?? '',
    line1: client.address.line1,
    line2: client.address.line2 ?? '',
    city: client.address.city,
    postalCode: client.address.postalCode ?? '',
    stateCode: client.address.stateCode ?? '',
    country: client.address.country,
    email: client.email ?? '',
    phone: client.phone ?? '',
  };
}

export function formToClient(form: ClientFormState, id: string): Client {
  return normaliseClient({
    id,
    name: form.name,
    gstin: form.gstin,
    pan: form.pan,
    address: {
      line1: form.line1,
      line2: form.line2,
      city: form.city,
      postalCode: form.postalCode,
      stateCode: form.stateCode,
      country: form.country,
    },
    email: form.email,
    phone: form.phone,
  });
}

export function validateClientForm(form: ClientFormState): Issue[] {
  const client = formToClient(form, 'check');
  const issues = validateClient(client);
  if (client.address.line1.trim() === '') issues.push({ path: 'address.line1', message: "Enter the client's address" });
  if (client.address.city.trim() === '') issues.push({ path: 'address.city', message: "Enter the client's city" });
  return issues;
}

/** Stores the typed GSTIN upper-cased; a valid GSTIN also fills in the state and sets the country to India. */
export function applyClientGstin(form: ClientFormState, gstin: string): ClientFormState {
  const cleaned = gstin.trim().toUpperCase();
  const result = validateGstin(cleaned);
  return result.valid ? { ...form, gstin: cleaned, stateCode: result.stateCode, country: 'India' } : { ...form, gstin: cleaned };
}

export function isBlankClient(form: ClientFormState): boolean {
  return form.name.trim() === '' && form.line1.trim() === '' && form.city.trim() === '';
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @solokit/web test -- clientFormState`
Expected: PASS.
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): add client form state, mapping and validation

```

---

### Task 3: Editor model

**Files:**
- Create: `apps/web/src/invoice/editorModel.ts`
- Test: `apps/web/src/invoice/editorModel.test.ts`

**Interfaces:**
- Consumes: `inputs.ts`, `clientFormState.ts`, `issuesByField` is NOT needed here; domain: `createDraftInvoice`, `validateInvoice`, `isRealIsoDate`, types; `indianFiscalYear`, `lineAmount`, `percentOf` from `@solokit/core`.
- Produces (all exported from `editorModel.ts`):
  - `type DiscountKind = 'none' | 'percent' | 'amount'`
  - `interface LineDraft { id; description; code; quantity; unit: BillingUnit; rate; discountKind; discountValue; gstRate }` (strings except `unit`, `discountKind`)
  - `interface EditorState { invoiceId; number; numberEdited: boolean; kind: InvoiceKind; issueDate; dueDate; clientId; client: ClientFormState; saveClient: boolean; isExport: boolean; currency: CurrencyCode; placeOfSupplyStateCode; placeEdited: boolean; reverseCharge: boolean; exemptSupply: boolean; lines: LineDraft[]; tdsEnabled: boolean; tdsPercent; advance; notes; terms; themeId; createdAt }`
  - `todayIso(now: Date): string` (local date, `YYYY-MM-DD`)
  - `taxApplies(state: Pick<EditorState, 'isExport' | 'exemptSupply'>, profile: SellerProfile): boolean`
  - `emptyLine(id: string, profile: SellerProfile): LineDraft` (quantity `'1'`, unit `'fixed'`, GST rate `'18'` for regular sellers, otherwise `''`)
  - `newEditorState(input: { invoiceId; clientId; lineId; number; today; profile; defaultThemeId }): EditorState`
  - `invoiceToEditor(invoice: InvoiceRecord): EditorState`
  - `editorToInvoice(state, profile, now): { invoice: InvoiceRecord; parseIssues: Issue[] }`
  - `validateEditor(state, profile, now): Issue[]` (parse issues, the client form rules, then `validateInvoice` on the built invoice; one issue per path)
  - `previewLineAmount(line: LineDraft): Minor | null` (amount before GST after the discount, or null when the line cannot be calculated)
  - `duplicateInvoice(source: InvoiceRecord, input: { id: string; number: string; issueDate: string; now?: Date }): InvoiceRecord` (status `draft`, no due date, no advance, fresh timestamps, deep copy)

- [ ] **Step 1: Write the failing tests**

`apps/web/src/invoice/editorModel.test.ts`:
```ts
import { makeClient, makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { describe, expect, it } from 'vitest';
import { clientToForm } from './clientFormState';
import {
  duplicateInvoice,
  editorToInvoice,
  emptyLine,
  invoiceToEditor,
  newEditorState,
  previewLineAmount,
  taxApplies,
  todayIso,
  validateEditor,
  type EditorState,
  type LineDraft,
} from './editorModel';

const NOW = new Date(2026, 9, 14, 10, 30); // 14 Oct 2026, local time
const regular = makeSeller();
const unregistered = makeSeller({ gstStatus: 'unregistered', gstin: undefined });

const line = (overrides: Partial<LineDraft> = {}): LineDraft => ({
  id: 'l1',
  description: 'Consulting',
  code: '998312',
  quantity: '24',
  unit: 'hours',
  rate: '3000',
  discountKind: 'none',
  discountValue: '',
  gstRate: '18',
  ...overrides,
});

function complete(overrides: Partial<EditorState> = {}): EditorState {
  return {
    ...newEditorState({
      invoiceId: 'inv-1',
      clientId: 'client-1',
      lineId: 'l1',
      number: '2026-27/0001',
      today: '2026-10-14',
      profile: regular,
      defaultThemeId: 'classic',
    }),
    client: clientToForm(makeClient()),
    placeOfSupplyStateCode: '27',
    lines: [line()],
    ...overrides,
  };
}

describe('todayIso', () => {
  it('formats the local date', () => {
    expect(todayIso(NOW)).toBe('2026-10-14');
    expect(todayIso(new Date(2027, 0, 5))).toBe('2027-01-05');
  });
});

describe('taxApplies', () => {
  it('is true only for a regular seller on a domestic, non-exempt supply', () => {
    expect(taxApplies({ isExport: false, exemptSupply: false }, regular)).toBe(true);
    expect(taxApplies({ isExport: true, exemptSupply: false }, regular)).toBe(false);
    expect(taxApplies({ isExport: false, exemptSupply: true }, regular)).toBe(false);
    expect(taxApplies({ isExport: false, exemptSupply: false }, unregistered)).toBe(false);
    expect(taxApplies({ isExport: false, exemptSupply: false }, makeSeller({ gstStatus: 'composition' }))).toBe(false);
  });
});

describe('emptyLine and newEditorState', () => {
  it('starts a line as one fixed fee with 18% GST for regular sellers only', () => {
    expect(emptyLine('a', regular)).toMatchObject({ id: 'a', quantity: '1', unit: 'fixed', gstRate: '18', discountKind: 'none' });
    expect(emptyLine('a', unregistered).gstRate).toBe('');
  });

  it('starts a new invoice with the profile defaults', () => {
    const state = newEditorState({
      invoiceId: 'i',
      clientId: 'c',
      lineId: 'l',
      number: '2026-27/0001',
      today: '2026-10-14',
      profile: makeSeller({ defaultNotes: 'Thanks', defaultTerms: 'Net 15' }),
      defaultThemeId: 'modern',
    });
    expect(state).toMatchObject({
      invoiceId: 'i',
      number: '2026-27/0001',
      numberEdited: false,
      kind: 'invoice',
      issueDate: '2026-10-14',
      dueDate: '',
      clientId: 'c',
      saveClient: true,
      isExport: false,
      placeEdited: false,
      tdsEnabled: false,
      tdsPercent: '10',
      advance: '',
      notes: 'Thanks',
      terms: 'Net 15',
      themeId: 'modern',
    });
    expect(state.lines).toHaveLength(1);
  });
});

describe('editorToInvoice', () => {
  it('builds a domestic tax invoice from typed values', () => {
    const { invoice, parseIssues } = editorToInvoice(complete(), regular, NOW);
    expect(parseIssues).toEqual([]);
    expect(invoice).toMatchObject({
      id: 'inv-1',
      number: '2026-27/0001',
      fiscalYear: '2026-27',
      kind: 'invoice',
      status: 'draft',
      issueDate: '2026-10-14',
      currency: 'INR',
      isExport: false,
      placeOfSupplyStateCode: '27',
      reverseCharge: false,
      exemptSupply: false,
      themeId: 'classic',
      lines: [{ id: 'l1', description: 'Consulting', code: '998312', quantity: 24, unit: 'hours', rate: 300000, gstRate: 18 }],
    });
    expect(invoice.client).toMatchObject({ id: 'client-1', name: 'Northwind Traders', address: { country: 'India', stateCode: '27' } });
    expect(invoice.seller.name).toBe('Asha Rao Consulting');
  });

  it('maps discounts, TDS, advance, notes, terms and the due date', () => {
    const { invoice, parseIssues } = editorToInvoice(
      complete({
        lines: [line({ discountKind: 'percent', discountValue: '10' }), line({ id: 'l2', discountKind: 'amount', discountValue: '500' })],
        tdsEnabled: true,
        tdsPercent: '2.5',
        advance: '10,000',
        notes: ' Thanks ',
        terms: 'Net 15',
        dueDate: '2026-10-29',
      }),
      regular,
      NOW,
    );
    expect(parseIssues).toEqual([]);
    expect(invoice.lines[0]?.discount).toEqual({ kind: 'percent', percent: 10 });
    expect(invoice.lines[1]?.discount).toEqual({ kind: 'amount', amount: 50000 });
    expect(invoice.tds).toEqual({ ratePercent: 2.5 });
    expect(invoice.advanceReceived).toBe(1000000);
    expect(invoice.notes).toBe('Thanks');
    expect(invoice.terms).toBe('Net 15');
    expect(invoice.dueDate).toBe('2026-10-29');
  });

  it('leaves out the GST rate and place of supply when no GST applies', () => {
    const state = complete({ lines: [line()], placeOfSupplyStateCode: '27' });
    const { invoice } = editorToInvoice(state, unregistered, NOW);
    expect(invoice.lines[0]?.gstRate).toBeUndefined();
    expect(invoice.placeOfSupplyStateCode).toBeUndefined();
    expect(invoice.reverseCharge).toBe(false);
  });

  it('builds an export in the chosen currency without a place of supply or client state', () => {
    const { invoice } = editorToInvoice(
      complete({
        isExport: true,
        currency: 'USD',
        reverseCharge: true,
        client: { ...clientToForm(makeClient()), country: 'United States', stateCode: '27', gstin: '' },
      }),
      regular,
      NOW,
    );
    expect(invoice).toMatchObject({ isExport: true, currency: 'USD', reverseCharge: false });
    expect(invoice.placeOfSupplyStateCode).toBeUndefined();
    expect(invoice.client.address.country).toBe('United States');
    expect(invoice.client.address.stateCode).toBeUndefined();
    expect(invoice.lines[0]?.gstRate).toBeUndefined();
  });

  it('forces INR and India for a domestic invoice even if an export currency or country was left over', () => {
    const { invoice } = editorToInvoice(
      complete({ isExport: false, currency: 'EUR', client: { ...clientToForm(makeClient()), country: 'France' } }),
      regular,
      NOW,
    );
    expect(invoice.currency).toBe('INR');
    expect(invoice.client.address.country).toBe('India');
  });

  it('keeps exempt supply only for regular sellers', () => {
    expect(editorToInvoice(complete({ exemptSupply: true }), regular, NOW).invoice.exemptSupply).toBe(true);
    expect(editorToInvoice(complete({ exemptSupply: true }), unregistered, NOW).invoice.exemptSupply).toBe(false);
  });

  it('reports typed values that cannot be read, with the line they belong to', () => {
    const { parseIssues } = editorToInvoice(
      complete({
        lines: [line({ quantity: 'abc', rate: '12.345', discountKind: 'percent', discountValue: '150' })],
        tdsEnabled: true,
        tdsPercent: 'x',
        advance: '-5',
      }),
      regular,
      NOW,
    );
    expect(parseIssues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(['lines[0].quantity', 'lines[0].rate', 'lines[0].discount', 'tds.ratePercent', 'advanceReceived']),
    );
  });

  it('keeps the original creation time of a saved draft', () => {
    const { invoice } = editorToInvoice(complete({ createdAt: '2026-10-01T08:00:00.000Z' }), regular, NOW);
    expect(invoice.createdAt).toBe('2026-10-01T08:00:00.000Z');
  });

  it('copes with an invalid issue date without throwing', () => {
    const { invoice, parseIssues } = editorToInvoice(complete({ issueDate: '' }), regular, NOW);
    expect(invoice.issueDate).toBe('2026-10-14');
    expect(parseIssues.map((issue) => issue.path)).toContain('issueDate');
  });
});

describe('invoiceToEditor', () => {
  it('round-trips a saved invoice', () => {
    const saved = makeInvoice({
      status: 'draft',
      dueDate: '2026-10-29',
      notes: 'Thanks',
      terms: 'Net 15',
      tds: { ratePercent: 10 },
      advanceReceived: 1000000,
      lines: [
        { id: 'a', description: 'Design', code: '998391', quantity: 7.5, unit: 'days', rate: 250050, gstRate: 18, discount: { kind: 'percent', percent: 5 } },
        { id: 'b', description: 'Hosting', quantity: 1, unit: 'fixed', rate: 100000, gstRate: 5, discount: { kind: 'amount', amount: 2500 } },
      ],
    });
    const state = invoiceToEditor(saved);
    expect(state.numberEdited).toBe(true);
    expect(state.placeEdited).toBe(true);
    expect(state.clientId).toBe(saved.client.id);
    const { invoice } = editorToInvoice(state, saved.seller, NOW);
    expect(invoice.lines).toEqual(saved.lines);
    expect(invoice).toMatchObject({
      number: saved.number,
      issueDate: saved.issueDate,
      dueDate: '2026-10-29',
      currency: 'INR',
      placeOfSupplyStateCode: '27',
      notes: 'Thanks',
      terms: 'Net 15',
      tds: { ratePercent: 10 },
      advanceReceived: 1000000,
      createdAt: saved.createdAt,
    });
    expect(invoice.client).toEqual(saved.client);
  });
});

describe('validateEditor', () => {
  it('accepts a complete invoice', () => {
    expect(validateEditor(complete(), regular, NOW)).toEqual([]);
  });

  it('asks for the client, the lines and the place of supply', () => {
    const state = complete({
      client: { ...clientToForm(makeClient()), name: '', line1: '', city: '' },
      lines: [line({ description: '' })],
      placeOfSupplyStateCode: '',
    });
    const paths = validateEditor(state, regular, NOW).map((issue) => issue.path);
    expect(paths).toEqual(
      expect.arrayContaining(['client.name', 'client.address.line1', 'client.address.city', 'lines[0].description', 'placeOfSupplyStateCode']),
    );
  });

  it('reports each problem once', () => {
    const paths = validateEditor(complete({ lines: [line({ quantity: '0' })] }), regular, NOW).map((issue) => issue.path);
    expect(paths.filter((path) => path === 'lines[0].quantity')).toHaveLength(1);
  });

  it('flags an advance larger than the invoice', () => {
    const paths = validateEditor(complete({ advance: '99999999' }), regular, NOW).map((issue) => issue.path);
    expect(paths).toContain('advanceReceived');
  });

  it('flags a profile problem under seller.*', () => {
    const broken = makeSeller({ name: '' });
    const paths = validateEditor(complete(), broken, NOW).map((issue) => issue.path);
    expect(paths).toContain('seller.name');
  });

  it('accepts an unregistered seller with no GST fields', () => {
    const state = complete({ lines: [line({ gstRate: '', code: '' })], placeOfSupplyStateCode: '' });
    expect(validateEditor(state, unregistered, NOW)).toEqual([]);
  });

  it('accepts an export in dollars', () => {
    const state = complete({
      isExport: true,
      currency: 'USD',
      client: { ...clientToForm(makeClient()), country: 'United States', gstin: '', stateCode: '', city: 'Austin', line1: '1 Main St' },
    });
    expect(validateEditor(state, regular, NOW)).toEqual([]);
  });
});

describe('previewLineAmount', () => {
  it('multiplies quantity by rate and applies the discount', () => {
    expect(previewLineAmount(line())).toBe(7200000);
    expect(previewLineAmount(line({ discountKind: 'percent', discountValue: '10' }))).toBe(6480000);
    expect(previewLineAmount(line({ discountKind: 'amount', discountValue: '500' }))).toBe(7150000);
  });

  it('gives null when something cannot be read or the discount is too big', () => {
    expect(previewLineAmount(line({ rate: 'x' }))).toBeNull();
    expect(previewLineAmount(line({ quantity: '' }))).toBeNull();
    expect(previewLineAmount(line({ discountKind: 'percent', discountValue: '' }))).toBeNull();
    expect(previewLineAmount(line({ discountKind: 'amount', discountValue: '99999999' }))).toBeNull();
  });
});

describe('duplicateInvoice', () => {
  it('copies an invoice into a new draft', () => {
    const source = makeInvoice({
      status: 'issued',
      kind: 'proforma',
      dueDate: '2026-10-29',
      advanceReceived: 500000,
      tds: { ratePercent: 10 },
      notes: 'Thanks',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const copy = duplicateInvoice(source, { id: 'new', number: '2026-27/0002', issueDate: '2026-11-02', now: new Date('2026-11-02T09:00:00.000Z') });
    expect(copy).toMatchObject({
      id: 'new',
      number: '2026-27/0002',
      fiscalYear: '2026-27',
      issueDate: '2026-11-02',
      status: 'draft',
      kind: 'proforma',
      tds: { ratePercent: 10 },
      notes: 'Thanks',
      createdAt: '2026-11-02T09:00:00.000Z',
      updatedAt: '2026-11-02T09:00:00.000Z',
    });
    expect('dueDate' in copy).toBe(false);
    expect('advanceReceived' in copy).toBe(false);
    expect(copy.lines).toEqual(source.lines);
    expect(copy.lines).not.toBe(source.lines);
    expect(copy.client).not.toBe(source.client);
    expect(source.status).toBe('issued');
  });

  it('works out the financial year of the new date', () => {
    const copy = duplicateInvoice(makeInvoice(), { id: 'n', number: '2027-28/0001', issueDate: '2027-04-02' });
    expect(copy.fiscalYear).toBe('2027-28');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- editorModel`
Expected: FAIL (cannot resolve `./editorModel`).

- [ ] **Step 3: Implement**

`apps/web/src/invoice/editorModel.ts`:
```ts
import { indianFiscalYear, lineAmount, percentOf, type Minor } from '@solokit/core';
import {
  createDraftInvoice,
  isRealIsoDate,
  validateInvoice,
  type BillingUnit,
  type CurrencyCode,
  type InvoiceKind,
  type InvoiceRecord,
  type Issue,
  type LineItem,
  type SellerProfile,
} from '@solokit/tool-invoice';
import { emptyClientForm, formToClient, validateClientForm, type ClientFormState } from './clientFormState';
import { formatAmountInput, formatQuantityInput, parseAmountInput, parsePercentInput, parseQuantityInput } from './inputs';

export type DiscountKind = 'none' | 'percent' | 'amount';

/** One invoice line as typed: everything is text until it is built into an invoice. */
export interface LineDraft {
  id: string;
  description: string;
  code: string;
  quantity: string;
  unit: BillingUnit;
  rate: string;
  discountKind: DiscountKind;
  discountValue: string;
  gstRate: string;
}

export interface EditorState {
  invoiceId: string;
  number: string;
  /** True once the number was typed by hand, so changing the date no longer renumbers it. */
  numberEdited: boolean;
  kind: InvoiceKind;
  issueDate: string;
  dueDate: string;
  clientId: string;
  client: ClientFormState;
  saveClient: boolean;
  isExport: boolean;
  /** Currency used when the invoice is an export. Domestic invoices are always INR. */
  currency: CurrencyCode;
  placeOfSupplyStateCode: string;
  /** True once the place of supply was chosen by hand, so it no longer follows the client's state. */
  placeEdited: boolean;
  reverseCharge: boolean;
  exemptSupply: boolean;
  lines: LineDraft[];
  tdsEnabled: boolean;
  tdsPercent: string;
  advance: string;
  notes: string;
  terms: string;
  themeId: string;
  createdAt: string;
}

export function todayIso(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function taxApplies(state: Pick<EditorState, 'isExport' | 'exemptSupply'>, profile: SellerProfile): boolean {
  return profile.gstStatus === 'regular' && !state.isExport && !state.exemptSupply;
}

export function emptyLine(id: string, profile: SellerProfile): LineDraft {
  return {
    id,
    description: '',
    code: '',
    quantity: '1',
    unit: 'fixed',
    rate: '',
    discountKind: 'none',
    discountValue: '',
    gstRate: profile.gstStatus === 'regular' ? '18' : '',
  };
}

export interface NewEditorInput {
  invoiceId: string;
  clientId: string;
  lineId: string;
  number: string;
  today: string;
  profile: SellerProfile;
  defaultThemeId: string;
}

export function newEditorState(input: NewEditorInput): EditorState {
  return {
    invoiceId: input.invoiceId,
    number: input.number,
    numberEdited: false,
    kind: 'invoice',
    issueDate: input.today,
    dueDate: '',
    clientId: input.clientId,
    client: emptyClientForm(),
    saveClient: true,
    isExport: false,
    currency: 'USD',
    placeOfSupplyStateCode: '',
    placeEdited: false,
    reverseCharge: false,
    exemptSupply: false,
    lines: [emptyLine(input.lineId, input.profile)],
    tdsEnabled: false,
    tdsPercent: '10',
    advance: '',
    notes: input.profile.defaultNotes ?? '',
    terms: input.profile.defaultTerms ?? '',
    themeId: input.defaultThemeId,
    createdAt: '',
  };
}

function lineToDraft(line: LineItem): LineDraft {
  const draft: LineDraft = {
    id: line.id,
    description: line.description,
    code: line.code ?? '',
    quantity: formatQuantityInput(line.quantity),
    unit: line.unit,
    rate: formatAmountInput(line.rate),
    discountKind: 'none',
    discountValue: '',
    gstRate: line.gstRate === undefined ? '' : String(line.gstRate),
  };
  if (line.discount?.kind === 'percent') {
    draft.discountKind = 'percent';
    draft.discountValue = String(line.discount.percent);
  } else if (line.discount?.kind === 'amount') {
    draft.discountKind = 'amount';
    draft.discountValue = formatAmountInput(line.discount.amount);
  }
  return draft;
}

/** Fills the editor from a saved invoice (an existing draft). */
export function invoiceToEditor(invoice: InvoiceRecord): EditorState {
  return {
    invoiceId: invoice.id,
    number: invoice.number,
    numberEdited: true,
    kind: invoice.kind,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate ?? '',
    clientId: invoice.client.id,
    client: {
      name: invoice.client.name,
      gstin: invoice.client.gstin ?? '',
      pan: invoice.client.pan ?? '',
      line1: invoice.client.address.line1,
      line2: invoice.client.address.line2 ?? '',
      city: invoice.client.address.city,
      postalCode: invoice.client.address.postalCode ?? '',
      stateCode: invoice.client.address.stateCode ?? '',
      country: invoice.client.address.country,
      email: invoice.client.email ?? '',
      phone: invoice.client.phone ?? '',
    },
    saveClient: false,
    isExport: invoice.isExport,
    currency: invoice.isExport ? invoice.currency : 'USD',
    placeOfSupplyStateCode: invoice.placeOfSupplyStateCode ?? '',
    placeEdited: true,
    reverseCharge: invoice.reverseCharge,
    exemptSupply: invoice.exemptSupply,
    lines: invoice.lines.map(lineToDraft),
    tdsEnabled: invoice.tds !== undefined,
    tdsPercent: invoice.tds ? String(invoice.tds.ratePercent) : '10',
    advance: invoice.advanceReceived !== undefined ? formatAmountInput(invoice.advanceReceived) : '',
    notes: invoice.notes ?? '',
    terms: invoice.terms ?? '',
    themeId: invoice.themeId,
    createdAt: invoice.createdAt,
  };
}

export interface BuildResult {
  invoice: InvoiceRecord;
  /** Typed values that could not be read (the invoice holds a harmless fallback for them). */
  parseIssues: Issue[];
}

/** The client as it should be saved: an export has a free-text country and no state; a domestic client is in India. */
function clientFormFor(state: EditorState): ClientFormState {
  return state.isExport ? { ...state.client, stateCode: '' } : { ...state.client, country: 'India' };
}

export function editorToInvoice(state: EditorState, profile: SellerProfile, now: Date): BuildResult {
  const parseIssues: Issue[] = [];
  const taxed = taxApplies(state, profile);

  const lines: LineItem[] = state.lines.map((draft, index) => {
    const at = `lines[${index}]`;
    const quantity = parseQuantityInput(draft.quantity);
    if (quantity === null) {
      parseIssues.push({ path: `${at}.quantity`, message: 'Enter a quantity such as 1 or 7.5 (up to 3 decimals)' });
    }
    const rate = parseAmountInput(draft.rate);
    if (rate === null) {
      parseIssues.push({ path: `${at}.rate`, message: 'Enter the rate as an amount such as 3000 or 3000.50' });
    }
    const line: LineItem = {
      id: draft.id,
      description: draft.description.trim(),
      quantity: quantity ?? 0,
      unit: draft.unit,
      rate: rate ?? 0,
    };
    if (draft.code.trim() !== '') line.code = draft.code.trim();
    if (draft.discountKind === 'percent') {
      const percent = parsePercentInput(draft.discountValue);
      if (percent === null) parseIssues.push({ path: `${at}.discount`, message: 'Enter a discount between 0 and 100' });
      else line.discount = { kind: 'percent', percent };
    } else if (draft.discountKind === 'amount') {
      const amount = parseAmountInput(draft.discountValue);
      if (amount === null) parseIssues.push({ path: `${at}.discount`, message: 'Enter the discount as an amount such as 500' });
      else line.discount = { kind: 'amount', amount };
    }
    if (taxed && draft.gstRate.trim() !== '') {
      const gstRate = Number(draft.gstRate);
      if (Number.isFinite(gstRate)) line.gstRate = gstRate;
    }
    return line;
  });

  let issueDate = state.issueDate;
  if (!isRealIsoDate(issueDate)) {
    parseIssues.push({ path: 'issueDate', message: 'Enter a valid issue date' });
    issueDate = todayIso(now);
  }

  const invoice = createDraftInvoice({
    id: state.invoiceId,
    number: state.number.trim(),
    issueDate,
    seller: profile,
    client: formToClient(clientFormFor(state), state.clientId),
    defaultThemeId: state.themeId,
    now,
  });
  invoice.kind = state.kind;
  invoice.isExport = state.isExport;
  invoice.currency = state.isExport ? state.currency : 'INR';
  invoice.reverseCharge = taxed && state.reverseCharge;
  invoice.exemptSupply = profile.gstStatus === 'regular' && state.exemptSupply;
  if (taxed && state.placeOfSupplyStateCode !== '') invoice.placeOfSupplyStateCode = state.placeOfSupplyStateCode;
  else delete invoice.placeOfSupplyStateCode;
  invoice.lines = lines;
  if (state.dueDate !== '') invoice.dueDate = state.dueDate;
  if (state.tdsEnabled) {
    const ratePercent = parsePercentInput(state.tdsPercent);
    if (ratePercent === null) parseIssues.push({ path: 'tds.ratePercent', message: 'Enter a TDS rate between 0 and 100' });
    else invoice.tds = { ratePercent };
  }
  if (state.advance.trim() !== '') {
    const advance = parseAmountInput(state.advance);
    if (advance === null) parseIssues.push({ path: 'advanceReceived', message: 'Enter the advance as an amount such as 10000' });
    else invoice.advanceReceived = advance;
  }
  const notes = state.notes.trim();
  if (notes !== '') invoice.notes = notes;
  else delete invoice.notes;
  const terms = state.terms.trim();
  if (terms !== '') invoice.terms = terms;
  else delete invoice.terms;
  if (state.createdAt !== '') invoice.createdAt = state.createdAt;
  return { invoice, parseIssues };
}

/** Every problem that must be fixed before the invoice can be issued, one per field. */
export function validateEditor(state: EditorState, profile: SellerProfile, now: Date): Issue[] {
  const { invoice, parseIssues } = editorToInvoice(state, profile, now);
  const issues: Issue[] = [];
  const seen = new Set<string>();
  const add = (list: Issue[], prefix = '') => {
    for (const issue of list) {
      const path = `${prefix}${issue.path}`;
      if (seen.has(path)) continue;
      seen.add(path);
      issues.push({ path, message: issue.message });
    }
  };
  add(parseIssues);
  add(validateClientForm(clientFormFor(state)), 'client.');
  add(validateInvoice(invoice));
  return issues;
}

/** The line's amount before GST and after its discount, or null when it cannot be worked out yet. */
export function previewLineAmount(line: LineDraft): Minor | null {
  const quantity = parseQuantityInput(line.quantity);
  const rate = parseAmountInput(line.rate);
  if (quantity === null || rate === null) return null;
  try {
    const gross = lineAmount(quantity, rate);
    if (line.discountKind === 'percent') {
      const percent = parsePercentInput(line.discountValue);
      return percent === null ? null : gross - percentOf(gross, percent);
    }
    if (line.discountKind === 'amount') {
      const amount = parseAmountInput(line.discountValue);
      return amount === null || amount > gross ? null : gross - amount;
    }
    return gross;
  } catch {
    return null;
  }
}

export interface DuplicateInput {
  id: string;
  number: string;
  issueDate: string;
  now?: Date;
}

/** A new draft with the same client, lines and options. The due date and any advance are not copied. */
export function duplicateInvoice(source: InvoiceRecord, input: DuplicateInput): InvoiceRecord {
  const stamp = (input.now ?? new Date()).toISOString();
  const copy = structuredClone(source);
  delete copy.dueDate;
  delete copy.advanceReceived;
  return {
    ...copy,
    id: input.id,
    number: input.number,
    fiscalYear: indianFiscalYear(input.issueDate),
    issueDate: input.issueDate,
    status: 'draft',
    createdAt: stamp,
    updatedAt: stamp,
  };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @solokit/web test -- editorModel`
Expected: PASS.
If a hand-computed expectation fails (for example the round-trip of `makeInvoice` snapshots, or the 'advance larger than the invoice' case), print the actual value and report it; do not weaken the assertion. The advance test relies on `validateInvoice` catching `advanceReceived > grand total - TDS`.
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): add the editor model: form state, invoice building, validation and duplication

```

---

### Task 4: Line items editor

**Files:**
- Create: `apps/web/src/invoice/LineItemsEditor.tsx`, `LineItemsEditor.module.css`
- Test: `apps/web/src/invoice/LineItemsEditor.test.tsx`

**Interfaces:**
- Consumes: `LineDraft`, `emptyLine`, `previewLineAmount` from `editorModel`; `BILLING_UNITS`, `BILLING_UNIT_LABELS`, `COMMON_SERVICE_CODES`, `SUPPORTED_CURRENCIES`, `formatAmount`, `type CurrencyCode` from `@solokit/tool-invoice`; `CURRENT_GST_SLABS`, `SPECIAL_GST_RATES`, `LEGACY_GST_SLABS`, `GST_SLAB_REFORM_DATE`, `isLegacyRateForDate` from `@solokit/tax-engines`; `formatIsoDate` from `@solokit/ui`; `newId` from `./ids`.
- Produces: `LineItemsEditor({ lines, onChange, taxApplies, currency, issueDate, profile, errors })` where `errors` is a `Record<string, string>` keyed like `lines[0].rate`. Renders one `<fieldset>` per item with the legend "Item N" containing: "Description", "HSN/SAC code" (a text input with a shared `<datalist>` of `COMMON_SERVICE_CODES` and the hint "Suggestions come from a short list of common codes. It is not an official register: type any code you need."), "Quantity", "Unit", "Rate (SYMBOL)", "Discount" select ("No discount", "Percent (%)", "Amount"), "Discount value" (only when a discount is chosen), "GST rate" (only when `taxApplies`), a line "Amount before GST: X" (or "Amount before GST: not worked out yet"), a "Remove item" button (disabled when there is only one item), and an "Add item" button after the list.
- GST rate options: current slabs and special rates labelled `N%`; old rates (12, 28) are added, labelled `N% (old rate)`, only when `issueDate` is before `GST_SLAB_REFORM_DATE` or the line already uses one. A line whose rate is old and `isLegacyRateForDate(rate, issueDate)` shows a warning notice: "12% was withdrawn on 22 Sep 2025. Check the rate for an invoice dated 14 Oct 2026." (date formatted with `formatIsoDate`).

- [ ] **Step 1: Write the failing tests**

`apps/web/src/invoice/LineItemsEditor.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { makeSeller } from '@solokit/tool-invoice/testing';
import { describe, expect, it } from 'vitest';
import { emptyLine, type LineDraft } from './editorModel';
import { LineItemsEditor } from './LineItemsEditor';

const regular = makeSeller();
const unregistered = makeSeller({ gstStatus: 'unregistered', gstin: undefined });

function Harness({
  initial,
  taxApplies = true,
  issueDate = '2026-10-14',
  errors = {},
  profile = regular,
  currency = 'INR' as const,
}: {
  initial?: LineDraft[];
  taxApplies?: boolean;
  issueDate?: string;
  errors?: Record<string, string>;
  profile?: typeof regular;
  currency?: 'INR' | 'USD';
}) {
  const [lines, setLines] = useState<LineDraft[]>(initial ?? [emptyLine('a', profile)]);
  return (
    <>
      <LineItemsEditor lines={lines} onChange={setLines} taxApplies={taxApplies} currency={currency} issueDate={issueDate} profile={profile} errors={errors} />
      <output aria-label="count">{lines.length}</output>
    </>
  );
}

const item = (n: number) => screen.getByRole('group', { name: `Item ${n}` });

describe('LineItemsEditor fields', () => {
  it('shows the fields of an item, with the GST rate only when GST applies', () => {
    render(<Harness />);
    const first = within(item(1));
    expect(first.getByLabelText('Description')).toBeInTheDocument();
    expect(first.getByLabelText('HSN/SAC code')).toBeInTheDocument();
    expect(first.getByLabelText('Quantity')).toHaveValue('1');
    expect(first.getByLabelText('Unit')).toHaveValue('fixed');
    expect(first.getByLabelText('Rate (₹)')).toBeInTheDocument();
    expect(first.getByLabelText('Discount')).toHaveValue('none');
    expect(first.getByLabelText('GST rate')).toHaveValue('18');
    expect(first.queryByLabelText('Discount value')).not.toBeInTheDocument();
  });

  it('leaves out the GST rate when no GST applies', () => {
    render(<Harness taxApplies={false} profile={unregistered} />);
    expect(within(item(1)).queryByLabelText('GST rate')).not.toBeInTheDocument();
  });

  it('labels the rate with the invoice currency', () => {
    render(<Harness currency="USD" />);
    expect(within(item(1)).getByLabelText('Rate ($)')).toBeInTheDocument();
  });

  it('suggests common SAC codes and says they are not an official register', () => {
    render(<Harness />);
    const input = within(item(1)).getByLabelText('HSN/SAC code');
    const listId = input.getAttribute('list');
    expect(listId).toBeTruthy();
    const options = document.querySelectorAll(`datalist#${CSS.escape(listId as string)} option`);
    expect(options.length).toBeGreaterThan(5);
    expect(input).toHaveAccessibleDescription(/not an official register/);
  });

  it('shows a discount value field once a discount type is chosen', async () => {
    render(<Harness />);
    await userEvent.selectOptions(within(item(1)).getByLabelText('Discount'), 'percent');
    expect(within(item(1)).getByLabelText('Discount value')).toBeInTheDocument();
  });

  it('shows the amount before GST, or says it is not worked out yet', async () => {
    render(<Harness />);
    expect(within(item(1)).getByText('Amount before GST: not worked out yet')).toBeInTheDocument();
    await userEvent.type(within(item(1)).getByLabelText('Rate (₹)'), '3000');
    expect(within(item(1)).getByText('Amount before GST: ₹3,000.00')).toBeInTheDocument();
    await userEvent.clear(within(item(1)).getByLabelText('Quantity'));
    await userEvent.type(within(item(1)).getByLabelText('Quantity'), '24');
    expect(within(item(1)).getByText('Amount before GST: ₹72,000.00')).toBeInTheDocument();
  });

  it('shows the error for each field', () => {
    render(<Harness errors={{ 'lines[0].description': 'Describe what you are charging for', 'lines[0].rate': 'Enter the rate' }} />);
    expect(within(item(1)).getByLabelText('Description')).toHaveAttribute('aria-invalid', 'true');
    expect(within(item(1)).getByText('Describe what you are charging for')).toBeInTheDocument();
    expect(within(item(1)).getByLabelText('Rate (₹)')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('LineItemsEditor list actions', () => {
  it('adds items and removes them, but never the last one', async () => {
    render(<Harness />);
    expect(within(item(1)).getByRole('button', { name: 'Remove item' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getByLabelText('count')).toHaveTextContent('2');
    expect(item(2)).toBeInTheDocument();
    expect(within(item(1)).getByRole('button', { name: 'Remove item' })).toBeEnabled();
    await userEvent.click(within(item(2)).getByRole('button', { name: 'Remove item' }));
    expect(screen.getByLabelText('count')).toHaveTextContent('1');
  });

  it('starts a new item with the usual defaults', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Add item' }));
    expect(within(item(2)).getByLabelText('GST rate')).toHaveValue('18');
    expect(within(item(2)).getByLabelText('Quantity')).toHaveValue('1');
  });
});

describe('LineItemsEditor GST rates', () => {
  const rates = () => within(item(1)).getAllByRole('option').map((option) => option.textContent);

  it('offers the current slabs and the special rates, not the retired ones', () => {
    render(<Harness />);
    const options = within(within(item(1)).getByLabelText('GST rate')).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(expect.arrayContaining(['0%', '5%', '18%', '40%', '0.25%', '3%']));
    expect(options.some((label) => label?.includes('12%'))).toBe(false);
    expect(options.some((label) => label?.includes('28%'))).toBe(false);
    expect(rates().length).toBeGreaterThan(0);
  });

  it('offers the old rates for an invoice dated before 22 September 2025', () => {
    render(<Harness issueDate="2025-06-01" />);
    const options = within(within(item(1)).getByLabelText('GST rate')).getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(expect.arrayContaining(['12% (old rate)', '28% (old rate)']));
  });

  it('keeps an old rate a line already uses, and warns when the date is after the change', () => {
    render(<Harness initial={[{ ...emptyLine('a', regular), gstRate: '12' }]} />);
    expect(within(item(1)).getByLabelText('GST rate')).toHaveValue('12');
    const warning = within(item(1)).getByRole('status');
    expect(warning).toHaveTextContent('12% was withdrawn on 22 Sep 2025');
    expect(warning).toHaveTextContent('14 Oct 2026');
  });

  it('does not warn about an old rate on an invoice dated before the change', () => {
    render(<Harness issueDate="2025-06-01" initial={[{ ...emptyLine('a', regular), gstRate: '12' }]} />);
    expect(within(item(1)).queryByRole('status')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- LineItemsEditor`
Expected: FAIL (cannot resolve `./LineItemsEditor`).

- [ ] **Step 3: Implement**

`apps/web/src/invoice/LineItemsEditor.module.css`:
```css
.list {
  display: grid;
  gap: 1.25rem;
}

.item {
  display: grid;
  gap: 0.9rem;
  min-width: 0;
  margin: 0;
  padding: 1rem;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-m);
}

.legend {
  padding: 0 0.4rem;
  font-weight: 700;
}

.grid {
  display: grid;
  gap: 0.9rem;
  align-items: start;
  grid-template-columns: 1fr;
}

@media (min-width: 40rem) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
```

`apps/web/src/invoice/LineItemsEditor.tsx`:
```tsx
'use client';

import { useId } from 'react';
import {
  BILLING_UNITS,
  BILLING_UNIT_LABELS,
  COMMON_SERVICE_CODES,
  SUPPORTED_CURRENCIES,
  formatAmount,
  type CurrencyCode,
  type SellerProfile,
} from '@solokit/tool-invoice';
import {
  CURRENT_GST_SLABS,
  GST_SLAB_REFORM_DATE,
  LEGACY_GST_SLABS,
  SPECIAL_GST_RATES,
  isLegacyRateForDate,
} from '@solokit/tax-engines';
import { Button, Notice, SelectField, TextField, formatIsoDate } from '@solokit/ui';
import { emptyLine, previewLineAmount, type DiscountKind, type LineDraft } from './editorModel';
import { newId } from './ids';
import styles from './LineItemsEditor.module.css';

export interface LineItemsEditorProps {
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
  taxApplies: boolean;
  currency: CurrencyCode;
  issueDate: string;
  profile: SellerProfile;
  /** Messages keyed like `lines[0].rate`. */
  errors: Record<string, string>;
}

const DISCOUNT_OPTIONS: { value: DiscountKind; label: string }[] = [
  { value: 'none', label: 'No discount' },
  { value: 'percent', label: 'Percent (%)' },
  { value: 'amount', label: 'Amount' },
];

function gstRateOptions(line: LineDraft, issueDate: string): { value: string; label: string }[] {
  const options = [...CURRENT_GST_SLABS, ...SPECIAL_GST_RATES].map((rate) => ({ value: String(rate), label: `${rate}%` }));
  const beforeChange = issueDate < GST_SLAB_REFORM_DATE;
  for (const rate of LEGACY_GST_SLABS) {
    if (beforeChange || line.gstRate === String(rate)) options.push({ value: String(rate), label: `${rate}% (old rate)` });
  }
  return options;
}

export function LineItemsEditor({ lines, onChange, taxApplies, currency, issueDate, profile, errors }: LineItemsEditorProps) {
  const listId = useId();
  const symbol = SUPPORTED_CURRENCIES.find((candidate) => candidate.code === currency)?.symbol ?? currency;

  const update = (index: number, patch: Partial<LineDraft>) =>
    onChange(lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));

  return (
    <div className={styles.list}>
      <datalist id={listId}>
        {COMMON_SERVICE_CODES.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.description}
          </option>
        ))}
      </datalist>

      {lines.map((line, index) => {
        const at = `lines[${index}]`;
        const amount = previewLineAmount(line);
        const rate = Number(line.gstRate);
        const oldRateWarning = taxApplies && line.gstRate !== '' && isLegacyRateForDate(rate, issueDate);
        return (
          <fieldset key={line.id} className={styles.item}>
            <legend className={styles.legend}>{`Item ${index + 1}`}</legend>
            <TextField
              label="Description"
              value={line.description}
              onChange={(event) => update(index, { description: event.target.value })}
              error={errors[`${at}.description`]}
            />
            <div className={styles.grid}>
              <TextField
                label="HSN/SAC code"
                hint="Suggestions come from a short list of common codes. It is not an official register: type any code you need."
                list={listId}
                autoComplete="off"
                value={line.code}
                onChange={(event) => update(index, { code: event.target.value })}
              />
              <TextField
                label="Quantity"
                inputMode="decimal"
                autoComplete="off"
                value={line.quantity}
                onChange={(event) => update(index, { quantity: event.target.value })}
                error={errors[`${at}.quantity`]}
              />
              <SelectField
                label="Unit"
                options={BILLING_UNITS.map((unit) => ({ value: unit, label: BILLING_UNIT_LABELS[unit] }))}
                value={line.unit}
                onChange={(event) => update(index, { unit: event.target.value as LineDraft['unit'] })}
              />
              <TextField
                label={`Rate (${symbol})`}
                inputMode="decimal"
                autoComplete="off"
                value={line.rate}
                onChange={(event) => update(index, { rate: event.target.value })}
                error={errors[`${at}.rate`]}
              />
              <SelectField
                label="Discount"
                options={DISCOUNT_OPTIONS}
                value={line.discountKind}
                onChange={(event) => update(index, { discountKind: event.target.value as DiscountKind, discountValue: '' })}
              />
              {line.discountKind !== 'none' ? (
                <TextField
                  label="Discount value"
                  inputMode="decimal"
                  autoComplete="off"
                  hint={line.discountKind === 'percent' ? 'A percentage from 0 to 100' : `An amount in ${symbol}`}
                  value={line.discountValue}
                  onChange={(event) => update(index, { discountValue: event.target.value })}
                  error={errors[`${at}.discount`]}
                />
              ) : null}
              {taxApplies ? (
                <SelectField
                  label="GST rate"
                  options={gstRateOptions(line, issueDate)}
                  value={line.gstRate}
                  onChange={(event) => update(index, { gstRate: event.target.value })}
                  error={errors[`${at}.gstRate`]}
                />
              ) : null}
            </div>
            {oldRateWarning ? (
              <Notice tone="warning">
                {`${rate}% was withdrawn on ${formatIsoDate(GST_SLAB_REFORM_DATE)}. Check the rate for an invoice dated ${formatIsoDate(issueDate)}.`}
              </Notice>
            ) : null}
            <div className={styles.footer}>
              <p className={styles.amount}>
                {amount === null ? 'Amount before GST: not worked out yet' : `Amount before GST: ${formatAmount(amount, currency)}`}
              </p>
              <Button variant="secondary" disabled={lines.length === 1} onClick={() => onChange(lines.filter((_, position) => position !== index))}>
                Remove item
              </Button>
            </div>
          </fieldset>
        );
      })}

      <div>
        <Button variant="secondary" onClick={() => onChange([...lines, emptyLine(newId(), profile)])}>
          Add item
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @solokit/web test -- LineItemsEditor`
Expected: PASS.
Notes: `formatAmount(amount, currency)` gives `₹3,000.00` for INR. The accessible description test relies on `TextField`'s hint wiring from Plan 3C-1. If `CSS.escape` is missing in jsdom, use `document.getElementById(listId)` instead.
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): add the line items editor with SAC suggestions and GST rate choices

```

---

### Task 5: Client section

**Files:**
- Create: `apps/web/src/invoice/ClientSection.tsx`
- Test: `apps/web/src/invoice/ClientSection.test.tsx`

**Interfaces:**
- Consumes: `ClientFormState`, `applyClientGstin`, `clientToForm`, `emptyClientForm` from `clientFormState`; `selectableStates` from `profileFormState`; `Client` from `@solokit/tool-invoice`.
- Produces: `ClientSection({ value, clientId, savedClients, isExport, saveClient, errors, onChange, onSelectClient, onSaveClientChange })`:
  - A `SelectField` "Client" listing saved clients (by name) with the placeholder "New client"; choosing one calls `onSelectClient(client)`, choosing the placeholder calls `onSelectClient(null)`.
  - Fields "Client name", "Client GSTIN" (domestic only, hint "Leave empty if your client is not registered for GST."; typing goes through `applyClientGstin`), "Address line 1", "Address line 2", "City", "PIN code", "State" (domestic only, a `SelectField` with the placeholder "Choose a state"), "Country" (export only), "Email", "Phone", and the checkbox "Save this client for next time".
  - `errors` keys: `client.name`, `client.gstin`, `client.address.line1`, `client.address.city`, `client.address.country`, `client.email`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/invoice/ClientSection.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { makeClient } from '@solokit/tool-invoice/testing';
import { describe, expect, it, vi } from 'vitest';
import { clientToForm, emptyClientForm, type ClientFormState } from './clientFormState';
import { ClientSection } from './ClientSection';

function Harness({
  isExport = false,
  saved = [makeClient({ id: 'c1', name: 'Northwind Traders' }), makeClient({ id: 'c2', name: 'Acme Co' })],
  errors = {},
  onSelect = () => {},
  initial = emptyClientForm(),
}: {
  isExport?: boolean;
  saved?: ReturnType<typeof makeClient>[];
  errors?: Record<string, string>;
  onSelect?: (client: ReturnType<typeof makeClient> | null) => void;
  initial?: ClientFormState;
}) {
  const [value, setValue] = useState(initial);
  const [save, setSave] = useState(true);
  return (
    <ClientSection
      value={value}
      clientId="c-new"
      savedClients={saved}
      isExport={isExport}
      saveClient={save}
      errors={errors}
      onChange={setValue}
      onSelectClient={(client) => {
        onSelect(client);
        setValue(client ? clientToForm(client) : emptyClientForm());
      }}
      onSaveClientChange={setSave}
    />
  );
}

describe('ClientSection (domestic)', () => {
  it('offers saved clients and a New client choice', () => {
    render(<Harness />);
    const select = screen.getByLabelText('Client');
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: 'New client' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Northwind Traders' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Acme Co' })).toBeInTheDocument();
  });

  it('shows the domestic fields and hides the export ones', () => {
    render(<Harness />);
    for (const label of ['Client name', 'Client GSTIN', 'Address line 1', 'Address line 2', 'City', 'PIN code', 'State', 'Email', 'Phone']) {
      expect(screen.getByLabelText(label), label).toBeInTheDocument();
    }
    expect(screen.queryByLabelText('Country')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Client GSTIN')).toHaveAccessibleDescription('Leave empty if your client is not registered for GST.');
  });

  it('fills the form when a saved client is chosen, and clears it for New client', async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await userEvent.selectOptions(screen.getByLabelText('Client'), 'c1');
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'c1' }));
    expect(screen.getByLabelText('Client name')).toHaveValue('Northwind Traders');
    expect(screen.getByLabelText('Client')).toHaveValue('c1');
    await userEvent.selectOptions(screen.getByLabelText('Client'), '');
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(screen.getByLabelText('Client name')).toHaveValue('');
  });

  it('fills the state from a valid GSTIN', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Client GSTIN'), '29aagcb7383j1z4');
    expect(screen.getByLabelText('Client GSTIN')).toHaveValue('29AAGCB7383J1Z4');
    expect(screen.getByLabelText('State')).toHaveValue('29');
  });

  it('shows errors on the right fields', () => {
    render(<Harness errors={{ 'client.name': 'Enter the client name', 'client.address.city': "Enter the client's city" }} />);
    expect(screen.getByLabelText('Client name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('City')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter the client name')).toBeInTheDocument();
  });

  it('lets the user choose whether to save the client', async () => {
    render(<Harness />);
    const box = screen.getByRole('checkbox', { name: 'Save this client for next time' });
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(box).not.toBeChecked();
  });
});

describe('ClientSection (export)', () => {
  it('asks for a country instead of a GSTIN and a state', () => {
    render(<Harness isExport />);
    expect(screen.getByLabelText('Country')).toBeInTheDocument();
    expect(screen.queryByLabelText('Client GSTIN')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('State')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Address line 1')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- ClientSection`
Expected: FAIL (cannot resolve `./ClientSection`).

- [ ] **Step 3: Implement**

`apps/web/src/invoice/ClientSection.tsx`:
```tsx
'use client';

import type { Client } from '@solokit/tool-invoice';
import { CheckboxField, SelectField, TextField } from '@solokit/ui';
import { applyClientGstin, type ClientFormState } from './clientFormState';
import { selectableStates } from './profileFormState';

export interface ClientSectionProps {
  value: ClientFormState;
  /** The id of the client being edited: a saved client's id, or a fresh id for a new one. */
  clientId: string;
  savedClients: Client[];
  isExport: boolean;
  saveClient: boolean;
  /** Messages keyed like `client.name`. */
  errors: Record<string, string>;
  onChange: (next: ClientFormState) => void;
  onSelectClient: (client: Client | null) => void;
  onSaveClientChange: (save: boolean) => void;
}

export function ClientSection({
  value,
  clientId,
  savedClients,
  isExport,
  saveClient,
  errors,
  onChange,
  onSelectClient,
  onSaveClientChange,
}: ClientSectionProps) {
  const set = <K extends keyof ClientFormState>(key: K, next: ClientFormState[K]) => onChange({ ...value, [key]: next });
  const text = (key: Exclude<keyof ClientFormState, never>) => ({
    value: value[key],
    onChange: (event: { target: { value: string } }) => set(key, event.target.value),
  });
  const selected = savedClients.some((client) => client.id === clientId) ? clientId : '';

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {savedClients.length > 0 ? (
        <SelectField
          label="Client"
          placeholder="New client"
          options={savedClients.map((client) => ({ value: client.id, label: client.name }))}
          value={selected}
          onChange={(event) => onSelectClient(savedClients.find((client) => client.id === event.target.value) ?? null)}
        />
      ) : null}
      <TextField label="Client name" required autoComplete="off" {...text('name')} error={errors['client.name']} />
      {!isExport ? (
        <TextField
          label="Client GSTIN"
          hint="Leave empty if your client is not registered for GST."
          autoComplete="off"
          value={value.gstin}
          onChange={(event) => onChange(applyClientGstin(value, event.target.value))}
          error={errors['client.gstin']}
        />
      ) : null}
      <TextField label="Address line 1" required autoComplete="off" {...text('line1')} error={errors['client.address.line1']} />
      <TextField label="Address line 2" autoComplete="off" {...text('line2')} />
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', alignItems: 'start' }}>
        <TextField label="City" required autoComplete="off" {...text('city')} error={errors['client.address.city']} />
        <TextField label="PIN code" autoComplete="off" {...text('postalCode')} />
        {isExport ? (
          <TextField label="Country" required autoComplete="off" {...text('country')} error={errors['client.address.country']} />
        ) : (
          <SelectField label="State" placeholder="Choose a state" options={selectableStates()} {...text('stateCode')} />
        )}
      </div>
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', alignItems: 'start' }}>
        <TextField label="Email" type="email" autoComplete="off" {...text('email')} error={errors['client.email']} />
        <TextField label="Phone" type="tel" autoComplete="off" {...text('phone')} />
      </div>
      <CheckboxField
        label="Save this client for next time"
        checked={saveClient}
        onChange={(event) => onSaveClientChange(event.target.checked)}
      />
    </div>
  );
}
```
Note: the `Client` picker is only rendered when at least one client is saved, so the first-ever invoice has no empty selector. Update the test harness expectations accordingly: the tests above always pass two saved clients. Add one more test to the file:
```tsx
it('hides the client picker when there are no saved clients', () => {
  render(<Harness saved={[]} />);
  expect(screen.queryByLabelText('Client')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Client name')).toBeInTheDocument();
});
```
(Put it in the first `describe`.)

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @solokit/web test -- ClientSection`
Expected: PASS.
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): add the client section with saved-client picker

```

---

### Task 6: Details section and totals panel

**Files:**
- Create: `apps/web/src/invoice/DetailsSection.tsx`, `TotalsPanel.tsx`
- Test: `apps/web/src/invoice/DetailsSection.test.tsx`, `TotalsPanel.test.tsx`

**Interfaces:**
- `DetailsSection({ state, onChange, profile, themes, errors })` where `state: EditorState`, `onChange(patch: Partial<EditorState>)`, `themes: InvoiceTheme[]` (presets plus custom, already merged), `errors: Record<string, string>`. It renders four groups (fieldsets) with these controls:
  - Group "Invoice details": TextField "Invoice number" (typing sets `numberEdited: true`), TextField "Issue date" (`type="date"`), TextField "Due date" (`type="date"`, optional), SelectField "Document" with options `invoice` -> "Invoice" and `proforma` -> "Proforma invoice" (sets `kind`).
  - Group "Supply": CheckboxField "Client is outside India (export)" (sets `isExport`; when turned on also sets `reverseCharge: false`); SelectField "Currency" (export only; `SUPPORTED_CURRENCIES` as "INR - Indian rupee" etc., sets `currency`); SelectField "Place of supply" (only when `taxApplies`; options from `selectableStates()` plus the placeholder "Choose a state"; choosing sets `placeOfSupplyStateCode` and `placeEdited: true`); CheckboxField "Reverse charge applies" (only when `taxApplies`; hint "The buyer pays the GST instead of you."); CheckboxField "Exempt supply (bill of supply)" (only for regular sellers; hint "No GST is charged on this supply."; turning it on sets `reverseCharge: false`).
  - Group "Payment": CheckboxField "Client deducts TDS" (sets `tdsEnabled`); TextField "TDS rate (%)" (only when enabled; hint "Usually 10% for professional fees. Applied to the amount before GST."); TextField "Advance already received" (hint "Subtracted from the amount to pay.").
  - Group "Notes and style": TextAreaField "Notes", TextAreaField "Terms", SelectField "Invoice style" (themes by name, sets `themeId`).
  - `errors` keys used: `number`, `issueDate`, `dueDate`, `placeOfSupplyStateCode`, `tds.ratePercent`, `advanceReceived`.
- `TotalsPanel({ document })` where `document: InvoiceDocument | null`: heading "Totals"; when `null` shows "Fill in the details above to see the totals."; otherwise a description list of `document.totals` (label and amount; the `total` row emphasised), then "Amount in words" with `document.amountInWords`, and the declarations (each as a paragraph).

- [ ] **Step 1: Write the failing tests**

`apps/web/src/invoice/DetailsSection.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PRESET_THEMES } from '@solokit/tool-invoice';
import { makeSeller } from '@solokit/tool-invoice/testing';
import { describe, expect, it } from 'vitest';
import { newEditorState, type EditorState } from './editorModel';
import { DetailsSection } from './DetailsSection';

const regular = makeSeller();
const unregistered = makeSeller({ gstStatus: 'unregistered', gstin: undefined });
const composition = makeSeller({ gstStatus: 'composition' });

function Harness({
  profile = regular,
  errors = {},
  patch = {},
}: {
  profile?: typeof regular;
  errors?: Record<string, string>;
  patch?: Partial<EditorState>;
}) {
  const [state, setState] = useState<EditorState>({
    ...newEditorState({ invoiceId: 'i', clientId: 'c', lineId: 'l', number: '2026-27/0001', today: '2026-10-14', profile, defaultThemeId: 'classic' }),
    ...patch,
  });
  return (
    <>
      <DetailsSection state={state} onChange={(next) => setState((current) => ({ ...current, ...next }))} profile={profile} themes={[...PRESET_THEMES]} errors={errors} />
      <output aria-label="state">{JSON.stringify({ n: state.number, ne: state.numberEdited, k: state.kind, x: state.isExport, c: state.currency, p: state.placeOfSupplyStateCode, pe: state.placeEdited, rc: state.reverseCharge, ex: state.exemptSupply, tds: state.tdsEnabled, th: state.themeId })}</output>
    </>
  );
}

const current = () => JSON.parse(screen.getByLabelText('state').textContent ?? '{}') as Record<string, unknown>;

describe('DetailsSection: invoice details', () => {
  it('shows the number, dates and document type', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0001');
    expect(screen.getByLabelText('Issue date')).toHaveValue('2026-10-14');
    expect(screen.getByLabelText('Due date')).toHaveValue('');
    expect(screen.getByLabelText('Document')).toHaveValue('invoice');
  });

  it('marks the number as typed by hand once it is edited', async () => {
    render(<Harness />);
    await userEvent.clear(screen.getByLabelText('Invoice number'));
    await userEvent.type(screen.getByLabelText('Invoice number'), 'A-1');
    expect(current()).toMatchObject({ n: 'A-1', ne: true });
  });

  it('switches to a proforma invoice', async () => {
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText('Document'), 'proforma');
    expect(current().k).toBe('proforma');
  });

  it('shows errors on the number and the dates', () => {
    render(<Harness errors={{ number: 'That invoice number is already used.', issueDate: 'Enter a valid issue date' }} />);
    expect(screen.getByLabelText('Invoice number')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Issue date')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('That invoice number is already used.')).toBeInTheDocument();
  });
});

describe('DetailsSection: supply for a regular seller', () => {
  it('shows place of supply, reverse charge and exempt supply for a domestic invoice', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Place of supply')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Reverse charge applies' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Exempt supply (bill of supply)' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Currency')).not.toBeInTheDocument();
  });

  it('records a chosen place of supply as chosen by hand', async () => {
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText('Place of supply'), '29');
    expect(current()).toMatchObject({ p: '29', pe: true });
  });

  it('switches to an export: asks for a currency and drops the domestic GST options', async () => {
    render(<Harness patch={{ reverseCharge: true }} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Client is outside India (export)' }));
    expect(current()).toMatchObject({ x: true, rc: false });
    expect(screen.getByLabelText('Currency')).toHaveValue('USD');
    expect(screen.queryByLabelText('Place of supply')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Reverse charge applies' })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'EUR');
    expect(current().c).toBe('EUR');
  });

  it('turns reverse charge off when the supply becomes exempt', async () => {
    render(<Harness patch={{ reverseCharge: true }} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Exempt supply (bill of supply)' }));
    expect(current()).toMatchObject({ ex: true, rc: false });
    expect(screen.queryByLabelText('Place of supply')).not.toBeInTheDocument();
  });
});

describe('DetailsSection: supply for sellers who charge no GST', () => {
  it('offers only the export choice for an unregistered seller', () => {
    render(<Harness profile={unregistered} />);
    expect(screen.getByRole('checkbox', { name: 'Client is outside India (export)' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Place of supply')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Reverse charge applies' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Exempt supply (bill of supply)' })).not.toBeInTheDocument();
  });

  it('offers the same for a composition seller', () => {
    render(<Harness profile={composition} />);
    expect(screen.queryByLabelText('Place of supply')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Exempt supply (bill of supply)' })).not.toBeInTheDocument();
  });
});

describe('DetailsSection: payment, notes and style', () => {
  it('shows the TDS rate only when TDS is switched on', async () => {
    render(<Harness />);
    expect(screen.queryByLabelText('TDS rate (%)')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Client deducts TDS' }));
    expect(screen.getByLabelText('TDS rate (%)')).toHaveValue('10');
    expect(screen.getByLabelText('TDS rate (%)')).toHaveAccessibleDescription(/Usually 10% for professional fees/);
  });

  it('has an advance field', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Advance already received')).toHaveAccessibleDescription('Subtracted from the amount to pay.');
  });

  it('lists the invoice styles and records the choice', async () => {
    render(<Harness />);
    const select = screen.getByLabelText('Invoice style');
    const names = within(select).getAllByRole('option').map((option) => option.textContent);
    expect(names).toEqual(expect.arrayContaining(['Classic', 'Modern', 'Minimal', 'Bold', 'Consultant', 'Formal']));
    await userEvent.selectOptions(select, 'modern');
    expect(current().th).toBe('modern');
  });

  it('shows notes and terms with their defaults', () => {
    render(<Harness patch={{ notes: 'Thanks', terms: 'Net 15' }} />);
    expect(screen.getByLabelText('Notes')).toHaveValue('Thanks');
    expect(screen.getByLabelText('Terms')).toHaveValue('Net 15');
  });
});
```

`apps/web/src/invoice/TotalsPanel.test.tsx`:
```tsx
import { render, screen, within } from '@testing-library/react';
import { buildInvoiceDocument } from '@solokit/tool-invoice';
import { makeInvoice } from '@solokit/tool-invoice/testing';
import { describe, expect, it } from 'vitest';
import { TotalsPanel } from './TotalsPanel';

describe('TotalsPanel', () => {
  it('asks for the details when there is nothing to show yet', () => {
    render(<TotalsPanel document={null} />);
    expect(screen.getByRole('heading', { name: 'Totals' })).toBeInTheDocument();
    expect(screen.getByText('Fill in the details above to see the totals.')).toBeInTheDocument();
  });

  it('lists the totals, the amount in words and the declarations', () => {
    const document = buildInvoiceDocument(makeInvoice({ tds: { ratePercent: 10 } }));
    render(<TotalsPanel document={document} />);
    const list = screen.getByRole('list', { name: 'Totals' });
    const labels = within(list).getAllByRole('listitem').map((item) => item.textContent);
    expect(labels.some((text) => text?.includes('Taxable value') && text.includes('₹72,000.00'))).toBe(true);
    expect(labels.some((text) => text?.includes('CGST @9%') && text.includes('₹6,480.00'))).toBe(true);
    expect(labels.some((text) => text?.includes('Total') && text.includes('₹84,960.00'))).toBe(true);
    expect(labels.some((text) => text?.includes('Net payable') && text.includes('₹77,760.00'))).toBe(true);
    expect(screen.getByText('Eighty-Four Thousand Nine Hundred Sixty Rupees Only')).toBeInTheDocument();
    expect(screen.getByText(/TDS at 10% is expected to be deducted by the client/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- DetailsSection TotalsPanel`
Expected: FAIL (cannot resolve the modules).

- [ ] **Step 3: Implement the details section**

`apps/web/src/invoice/DetailsSection.tsx`:
```tsx
'use client';

import { SUPPORTED_CURRENCIES, type InvoiceTheme, type SellerProfile } from '@solokit/tool-invoice';
import { CheckboxField, SelectField, TextAreaField, TextField } from '@solokit/ui';
import { taxApplies, type EditorState } from './editorModel';
import { selectableStates } from './profileFormState';

export interface DetailsSectionProps {
  state: EditorState;
  onChange: (patch: Partial<EditorState>) => void;
  profile: SellerProfile;
  themes: InvoiceTheme[];
  /** Messages keyed like `issueDate`. */
  errors: Record<string, string>;
}

const groupStyle = { display: 'grid', gap: '1rem', minWidth: 0, margin: 0, padding: 0, border: 0 } as const;
const legendStyle = { padding: 0, marginBottom: '0.25rem', fontFamily: 'var(--ff-display)', fontSize: '1.25rem', fontWeight: 700 } as const;
const rowStyle = { display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', alignItems: 'start' } as const;

export function DetailsSection({ state, onChange, profile, themes, errors }: DetailsSectionProps) {
  const taxed = taxApplies(state, profile);
  const regular = profile.gstStatus === 'regular';

  return (
    <div style={{ display: 'grid', gap: '1.75rem' }}>
      <fieldset style={groupStyle}>
        <legend style={legendStyle}>Invoice details</legend>
        <div style={rowStyle}>
          <TextField
            label="Invoice number"
            autoComplete="off"
            value={state.number}
            onChange={(event) => onChange({ number: event.target.value, numberEdited: true })}
            error={errors['number']}
          />
          <SelectField
            label="Document"
            options={[
              { value: 'invoice', label: 'Invoice' },
              { value: 'proforma', label: 'Proforma invoice' },
            ]}
            value={state.kind}
            onChange={(event) => onChange({ kind: event.target.value as EditorState['kind'] })}
          />
          <TextField label="Issue date" type="date" value={state.issueDate} onChange={(event) => onChange({ issueDate: event.target.value })} error={errors['issueDate']} />
          <TextField label="Due date" type="date" value={state.dueDate} onChange={(event) => onChange({ dueDate: event.target.value })} error={errors['dueDate']} />
        </div>
      </fieldset>

      <fieldset style={groupStyle}>
        <legend style={legendStyle}>Supply</legend>
        <CheckboxField
          label="Client is outside India (export)"
          hint={regular ? 'Exports of services are zero-rated under a Letter of Undertaking, so no GST is charged.' : 'Bill your client in their own currency.'}
          checked={state.isExport}
          onChange={(event) => onChange({ isExport: event.target.checked, ...(event.target.checked ? { reverseCharge: false } : {}) })}
        />
        {state.isExport ? (
          <SelectField
            label="Currency"
            options={SUPPORTED_CURRENCIES.map((currency) => ({ value: currency.code, label: `${currency.code} - ${currency.name}` }))}
            value={state.currency}
            onChange={(event) => onChange({ currency: event.target.value as EditorState['currency'] })}
          />
        ) : null}
        {taxed ? (
          <SelectField
            label="Place of supply"
            required
            placeholder="Choose a state"
            hint="For services this is usually where your client is."
            options={selectableStates()}
            value={state.placeOfSupplyStateCode}
            onChange={(event) => onChange({ placeOfSupplyStateCode: event.target.value, placeEdited: true })}
            error={errors['placeOfSupplyStateCode']}
          />
        ) : null}
        {taxed ? (
          <CheckboxField
            label="Reverse charge applies"
            hint="The buyer pays the GST instead of you."
            checked={state.reverseCharge}
            onChange={(event) => onChange({ reverseCharge: event.target.checked })}
          />
        ) : null}
        {regular && !state.isExport ? (
          <CheckboxField
            label="Exempt supply (bill of supply)"
            hint="No GST is charged on this supply."
            checked={state.exemptSupply}
            onChange={(event) => onChange({ exemptSupply: event.target.checked, ...(event.target.checked ? { reverseCharge: false } : {}) })}
          />
        ) : null}
      </fieldset>

      <fieldset style={groupStyle}>
        <legend style={legendStyle}>Payment</legend>
        <CheckboxField label="Client deducts TDS" checked={state.tdsEnabled} onChange={(event) => onChange({ tdsEnabled: event.target.checked })} />
        {state.tdsEnabled ? (
          <TextField
            label="TDS rate (%)"
            hint="Usually 10% for professional fees. Applied to the amount before GST."
            inputMode="decimal"
            autoComplete="off"
            value={state.tdsPercent}
            onChange={(event) => onChange({ tdsPercent: event.target.value })}
            error={errors['tds.ratePercent']}
          />
        ) : null}
        <TextField
          label="Advance already received"
          hint="Subtracted from the amount to pay."
          inputMode="decimal"
          autoComplete="off"
          value={state.advance}
          onChange={(event) => onChange({ advance: event.target.value })}
          error={errors['advanceReceived']}
        />
      </fieldset>

      <fieldset style={groupStyle}>
        <legend style={legendStyle}>Notes and style</legend>
        <TextAreaField label="Notes" value={state.notes} onChange={(event) => onChange({ notes: event.target.value })} />
        <TextAreaField label="Terms" value={state.terms} onChange={(event) => onChange({ terms: event.target.value })} />
        <SelectField
          label="Invoice style"
          options={themes.map((theme) => ({ value: theme.id, label: theme.name }))}
          value={state.themeId}
          onChange={(event) => onChange({ themeId: event.target.value })}
        />
      </fieldset>
    </div>
  );
}
```

- [ ] **Step 4: Implement the totals panel**

`apps/web/src/invoice/TotalsPanel.tsx`:
```tsx
import type { InvoiceDocument } from '@solokit/tool-invoice';

export interface TotalsPanelProps {
  document: InvoiceDocument | null;
}

export function TotalsPanel({ document }: TotalsPanelProps) {
  return (
    <section aria-labelledby="totals-heading" style={{ display: 'grid', gap: '0.75rem' }}>
      <h3 id="totals-heading" style={{ fontSize: '1.25rem' }}>
        Totals
      </h3>
      {document === null ? (
        <p style={{ color: 'var(--text-muted)' }}>Fill in the details above to see the totals.</p>
      ) : (
        <>
          <ul aria-label="Totals" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.35rem' }} role="list">
            {document.totals.map((row) => (
              <li
                key={`${row.label}-${row.amount}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  fontWeight: row.emphasis === 'total' || row.emphasis === 'net' ? 700 : 400,
                  color: row.emphasis === 'muted' ? 'var(--text-muted)' : undefined,
                  borderTop: row.emphasis === 'total' ? '1.5px solid var(--edge)' : undefined,
                  paddingTop: row.emphasis === 'total' ? '0.4rem' : undefined,
                }}
              >
                <span>{row.label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.amount}</span>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{document.amountInWords}</p>
          {document.declarations.map((line) => (
            <p key={line} style={{ fontSize: '0.9rem' }}>
              {line}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
```
Note: the test finds the list by its accessible name "Totals" (`aria-label`), and the heading by `getByRole('heading', { name: 'Totals' })`; both exist. The amount-in-words test text equals the document's words string exactly.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @solokit/web test -- DetailsSection TotalsPanel`
Expected: PASS.
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): add the details section and the totals panel

```

---

### Task 7: PDF preview and download helpers

**Files:**
- Create: `apps/web/src/invoice/usePdfPreview.ts`, `PdfPreview.tsx`, `downloads.ts`
- Test: `apps/web/src/invoice/PdfPreview.test.tsx`, `downloads.test.ts`

**Interfaces:**
- `type PdfRenderer = (input: { invoice: InvoiceRecord; theme: InvoiceTheme }) => Promise<Blob>`
- `defaultPdfRenderer: PdfRenderer` (in `usePdfPreview.ts`): `const { renderInvoicePdf } = await import('@solokit/tool-invoice-pdf'); return renderInvoicePdf({ ...input, fontBase: '/fonts/invoice' });`
- `usePdfPreview({ invoice, theme, enabled, delayMs = 500, render = defaultPdfRenderer }): { status: 'idle' | 'rendering' | 'ready' | 'error'; url: string | null; error: string | null; retry(): void }`. Behaviour: when `enabled` and `invoice` and `theme` are present it waits `delayMs` after the last change, renders, and exposes a blob URL; previous URLs are revoked when replaced and on unmount; changing the invoice again while rendering discards the stale result; a render error gives `status: 'error'` with a plain message ("The PDF could not be built. Try again." for render errors, "The PDF tools could not be loaded. Check your connection and try again." when the error name is `ChunkLoadError` or the message mentions loading a chunk or module); `retry()` renders again.
- `PdfPreview({ state, filename, onRetry, placeholder })` where `state` is the hook result: shows `placeholder` (a string) when idle; "Building the preview…" while rendering; an `<iframe title="Invoice preview" src=url>` when ready, with the links "Open in a new tab" (`target="_blank" rel="noopener"`) and "Download PDF" (`download={filename}`); a danger `Notice` with a "Try again" button on error.
- `downloads.ts`: `downloadBlob(blob: Blob, filename: string): void` (creates an object URL, clicks a temporary anchor, revokes the URL).

- [ ] **Step 1: Write the failing tests**

`apps/web/src/invoice/downloads.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from './downloads';

afterEach(() => vi.restoreAllMocks());

describe('downloadBlob', () => {
  it('clicks a temporary link with the file name and then cleans up', () => {
    const create = vi.fn().mockReturnValue('blob:fake-1');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });
    downloadBlob(new Blob(['x'], { type: 'application/pdf' }), 'Invoice-1.pdf');
    expect(create).toHaveBeenCalledOnce();
    expect(clicked).toEqual([{ href: 'blob:fake-1', download: 'Invoice-1.pdf' }]);
    expect(revoke).toHaveBeenCalledWith('blob:fake-1');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
```

`apps/web/src/invoice/PdfPreview.test.tsx`:
```tsx
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PRESET_THEMES } from '@solokit/tool-invoice';
import { makeInvoice } from '@solokit/tool-invoice/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfPreview } from './PdfPreview';
import { usePdfPreview, type PdfRenderer } from './usePdfPreview';

const theme = PRESET_THEMES[0]!;
const invoice = makeInvoice();
let counter = 0;

beforeEach(() => {
  counter = 0;
  Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:fake-${++counter}`),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => vi.useRealTimers());

const blob = () => new Blob(['pdf'], { type: 'application/pdf' });

describe('usePdfPreview', () => {
  it('stays idle until it is enabled and has an invoice', () => {
    const render_ = vi.fn<PdfRenderer>().mockResolvedValue(blob());
    const { result } = renderHook(() => usePdfPreview({ invoice: null, theme, enabled: true, delayMs: 0, render: render_ }));
    expect(result.current.status).toBe('idle');
    const off = renderHook(() => usePdfPreview({ invoice, theme, enabled: false, delayMs: 0, render: render_ }));
    expect(off.result.current.status).toBe('idle');
    expect(render_).not.toHaveBeenCalled();
  });

  it('renders after the delay and exposes a blob URL', async () => {
    const render_ = vi.fn<PdfRenderer>().mockResolvedValue(blob());
    const { result } = renderHook(() => usePdfPreview({ invoice, theme, enabled: true, delayMs: 0, render: render_ }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.url).toBe('blob:fake-1');
    expect(render_).toHaveBeenCalledWith({ invoice, theme });
  });

  it('waits for the user to stop typing before rendering', async () => {
    vi.useFakeTimers();
    const render_ = vi.fn<PdfRenderer>().mockResolvedValue(blob());
    const { rerender } = renderHook(({ inv }) => usePdfPreview({ invoice: inv, theme, enabled: true, delayMs: 500, render: render_ }), {
      initialProps: { inv: invoice },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    rerender({ inv: { ...invoice, notes: 'changed' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(render_).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(render_).toHaveBeenCalledTimes(1);
  });

  it('revokes the old URL when a new one replaces it, and on unmount', async () => {
    const render_ = vi.fn<PdfRenderer>().mockImplementation(async () => blob());
    const { result, rerender, unmount } = renderHook(({ inv }) => usePdfPreview({ invoice: inv, theme, enabled: true, delayMs: 0, render: render_ }), {
      initialProps: { inv: invoice },
    });
    await waitFor(() => expect(result.current.url).toBe('blob:fake-1'));
    rerender({ inv: { ...invoice, notes: 'second' } });
    await waitFor(() => expect(result.current.url).toBe('blob:fake-2'));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-1');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-2');
  });

  it('ignores a slow render that was overtaken by a newer one', async () => {
    let finishFirst: (value: Blob) => void = () => {};
    const render_ = vi
      .fn<PdfRenderer>()
      .mockImplementationOnce(() => new Promise<Blob>((resolve) => (finishFirst = resolve)))
      .mockImplementation(async () => blob());
    const { result, rerender } = renderHook(({ inv }) => usePdfPreview({ invoice: inv, theme, enabled: true, delayMs: 0, render: render_ }), {
      initialProps: { inv: invoice },
    });
    await waitFor(() => expect(render_).toHaveBeenCalledTimes(1));
    rerender({ inv: { ...invoice, notes: 'newer' } });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const urlBefore = result.current.url;
    await act(async () => finishFirst(blob()));
    expect(result.current.url).toBe(urlBefore);
  });

  it('reports a render error in plain words and can try again', async () => {
    const render_ = vi.fn<PdfRenderer>().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(blob());
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => usePdfPreview({ invoice, theme, enabled: true, delayMs: 0, render: render_ }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('The PDF could not be built. Try again.');
    expect(spy).toHaveBeenCalled();
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    spy.mockRestore();
  });

  it('says so when the PDF tools could not be loaded', async () => {
    const chunkError = Object.assign(new Error('Loading chunk 42 failed.'), { name: 'ChunkLoadError' });
    const render_ = vi.fn<PdfRenderer>().mockRejectedValue(chunkError);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => usePdfPreview({ invoice, theme, enabled: true, delayMs: 0, render: render_ }));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('The PDF tools could not be loaded. Check your connection and try again.');
  });
});

describe('PdfPreview', () => {
  const base = { filename: 'Tax-Invoice-2026-27-0001.pdf', onRetry: () => {}, placeholder: 'Fill in the details to see the preview.' };

  it('shows the placeholder when idle', () => {
    render(<PdfPreview state={{ status: 'idle', url: null, error: null, retry: () => {} }} {...base} />);
    expect(screen.getByText('Fill in the details to see the preview.')).toBeInTheDocument();
    expect(screen.queryByTitle('Invoice preview')).not.toBeInTheDocument();
  });

  it('shows progress while rendering', () => {
    render(<PdfPreview state={{ status: 'rendering', url: null, error: null, retry: () => {} }} {...base} />);
    expect(screen.getByText('Building the preview…')).toBeInTheDocument();
  });

  it('shows the PDF with an open link and a download link when ready', () => {
    render(<PdfPreview state={{ status: 'ready', url: 'blob:fake', error: null, retry: () => {} }} {...base} />);
    expect(screen.getByTitle('Invoice preview')).toHaveAttribute('src', 'blob:fake');
    const open = screen.getByRole('link', { name: 'Open in a new tab' });
    expect(open).toHaveAttribute('href', 'blob:fake');
    expect(open).toHaveAttribute('target', '_blank');
    expect(open).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('download', 'Tax-Invoice-2026-27-0001.pdf');
  });

  it('keeps showing the last good PDF while a newer one is being built', () => {
    render(<PdfPreview state={{ status: 'rendering', url: 'blob:old', error: null, retry: () => {} }} {...base} />);
    expect(screen.getByTitle('Invoice preview')).toHaveAttribute('src', 'blob:old');
    expect(screen.getByText('Updating the preview…')).toBeInTheDocument();
  });

  it('shows the error with a Try again button', async () => {
    const onRetry = vi.fn();
    render(<PdfPreview state={{ status: 'error', url: null, error: 'The PDF could not be built. Try again.', retry: onRetry }} {...base} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The PDF could not be built. Try again.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```
(The hook keeps the last good URL while a newer render is in progress, so the preview does not flash empty on every keystroke: `status: 'rendering'` with a non-null `url` shows the old PDF plus "Updating the preview…".)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- PdfPreview downloads`
Expected: FAIL (missing modules).

- [ ] **Step 3: Implement**

`apps/web/src/invoice/downloads.ts`:
```ts
/** Saves a blob as a file by clicking a temporary link. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
```

`apps/web/src/invoice/usePdfPreview.ts`:
```ts
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InvoiceRecord, InvoiceTheme } from '@solokit/tool-invoice';

export type PdfRenderer = (input: { invoice: InvoiceRecord; theme: InvoiceTheme }) => Promise<Blob>;

/** Loads the PDF engine only when a preview or download is needed. */
export const defaultPdfRenderer: PdfRenderer = async (input) => {
  const { renderInvoicePdf } = await import('@solokit/tool-invoice-pdf');
  return renderInvoicePdf({ ...input, fontBase: '/fonts/invoice' });
};

export type PreviewStatus = 'idle' | 'rendering' | 'ready' | 'error';

export interface PdfPreviewState {
  status: PreviewStatus;
  /** The most recent successfully built PDF. Kept while a newer one is being built. */
  url: string | null;
  error: string | null;
  retry: () => void;
}

export interface UsePdfPreviewInput {
  invoice: InvoiceRecord | null;
  theme: InvoiceTheme | null;
  enabled: boolean;
  delayMs?: number;
  render?: PdfRenderer;
}

function describeError(error: unknown): string {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(text)) {
    return 'The PDF tools could not be loaded. Check your connection and try again.';
  }
  return 'The PDF could not be built. Try again.';
}

export function usePdfPreview({ invoice, theme, enabled, delayMs = 500, render = defaultPdfRenderer }: UsePdfPreviewInput): PdfPreviewState {
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const urlRef = useRef<string | null>(null);
  const renderRef = useRef(render);
  renderRef.current = render;

  const signature = useMemo(() => (invoice && theme ? JSON.stringify([invoice, theme]) : ''), [invoice, theme]);

  useEffect(() => {
    if (!enabled || !invoice || !theme) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('rendering');
    setError(null);
    const timer = setTimeout(() => {
      renderRef
        .current({ invoice, theme })
        .then((blob) => {
          if (cancelled) return;
          const next = URL.createObjectURL(blob);
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = next;
          setUrl(next);
          setStatus('ready');
        })
        .catch((failure: unknown) => {
          if (cancelled) return;
          console.error('Could not build the invoice PDF', failure);
          setError(describeError(failure));
          setStatus('error');
        });
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `signature` stands for the invoice and theme contents, so typing triggers one render per pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled, delayMs, attempt]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    },
    [],
  );

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { status, url, error, retry };
}
```

`apps/web/src/invoice/PdfPreview.tsx`:
```tsx
'use client';

import { Button, Notice } from '@solokit/ui';
import type { PdfPreviewState } from './usePdfPreview';

export interface PdfPreviewProps {
  state: PdfPreviewState;
  /** File name for the download link. */
  filename: string;
  onRetry: () => void;
  /** Shown when there is nothing to preview yet. */
  placeholder: string;
}

export function PdfPreview({ state, filename, onRetry, placeholder }: PdfPreviewProps) {
  if (state.status === 'error') {
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <Notice tone="danger" title="No preview">
          {state.error ?? 'The PDF could not be built. Try again.'}
        </Notice>
        <div>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      </div>
    );
  }
  if (state.url === null) {
    return <p style={{ color: 'var(--text-muted)' }}>{state.status === 'rendering' ? 'Building the preview…' : placeholder}</p>;
  }
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <iframe
        title="Invoice preview"
        src={state.url}
        style={{ width: '100%', height: '70vh', minHeight: '28rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-s)', background: '#fff' }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <a href={state.url} target="_blank" rel="noopener noreferrer">
          Open in a new tab
        </a>
        <a href={state.url} download={filename}>
          Download PDF
        </a>
        {state.status === 'rendering' ? <span style={{ color: 'var(--text-muted)' }}>Updating the preview…</span> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @solokit/web test -- PdfPreview downloads`
Expected: PASS.
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors. (If the lint comment about hook dependencies is flagged by a configured linter, keep it; this project has no ESLint setup yet. Importing `@solokit/tool-invoice-pdf` dynamically type-checks because the package is a workspace dependency since Plan 3C-1.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): add the PDF preview hook, preview component and download helper

```

---

### Task 8: The invoice editor screen

**Files:**
- Create: `apps/web/src/invoice/InvoiceEditor.tsx`, `InvoiceEditor.module.css`
- Test: `apps/web/src/invoice/InvoiceEditor.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1 to 7; `createInvoiceStorage`, `InvoiceStorage`, `issueInvoice`, `InvoiceNotValidError`, `InvoiceNumberTakenError`, `PRESET_THEMES`, `resolveTheme`, `buildInvoiceDocument`, `pdfFilename` from `@solokit/tool-invoice` (and `pdfFilename` from `@solokit/tool-invoice-pdf` is NOT imported statically: the file name is built by a small local helper `invoiceFileName(invoice)` that mirrors the package's rule, see below) ; `issuesByField` from `profileFormState`.
- Produces: `InvoiceEditor({ storage, profile, invoiceId, onBack, onIssued, renderPdf })`:
  - `storage: InvoiceStorage`, `profile: SellerProfile`, `invoiceId?: string` (an existing draft to edit; new invoice when absent), `onBack(): void`, `onIssued(id: string): void`, `renderPdf?: PdfRenderer` (defaults to `defaultPdfRenderer`; tests inject a fake).
  - Loads clients, settings, custom themes and (for an edit) the draft. A new invoice gets `storage.invoices.nextNumber(today)`. While loading it shows "Opening the invoice…". If the id is not found or is not a draft, shows a danger notice "This invoice cannot be edited" with a "Back to invoices" button.
  - Layout: heading "New invoice" (or "Edit draft"), a "Back to invoices" button, sections "Client", then `DetailsSection`'s groups, a heading "Items" with `LineItemsEditor`, `TotalsPanel`, and a preview panel (heading "Preview", a "Show preview"/"Hide preview" toggle button, `PdfPreview` when shown).
  - Number follows the issue date's financial year until the number is typed by hand (new invoices only). The place of supply follows the client's state until chosen by hand. Choosing a saved client fills the form and, for a domestic regular invoice, the place of supply.
  - Buttons: "Save draft" and "Issue invoice".
    - "Save draft": stops with the field errors only when typed numbers cannot be read (`parseIssues`); otherwise saves the draft (status stays `draft`), saves the client when "Save this client for next time" is checked and the client form is not blank, and shows the status message "Draft saved". A taken number shows the error "That invoice number is already used. Choose another." on the number field.
    - "Issue invoice": runs `validateEditor`; on problems it shows an error summary (a danger notice titled "Fix N things before you issue this invoice" listing each message) and focuses the first invalid field; on success it calls `issueInvoice`, saves the client (if wanted), saves the invoice and calls `onIssued(saved.id)`.
  - Errors are shown only after the first Save/Issue attempt and then follow the form live.
  - The preview is enabled only while the invoice is valid (`issues.length === 0`); otherwise the placeholder says "Fill in the details to see the preview."
  - Local helper `invoiceFileName(invoice)`: `${title}-${number}.pdf` with the same sanitising as `pdfFilename` (spaces in the title become hyphens; runs of characters other than letters and digits in the number become `-`; trim dashes). Use the title from `buildInvoiceDocument`.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/invoice/InvoiceEditor.test.tsx`:
```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createInvoiceStorage, type InvoiceStorage, type SellerProfile } from '@solokit/tool-invoice';
import { makeClient, makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { InvoiceEditor } from './InvoiceEditor';
import type { PdfRenderer } from './usePdfPreview';

const fakeRender: PdfRenderer = async () => new Blob(['pdf'], { type: 'application/pdf' });

async function setup(options: { profile?: SellerProfile; invoiceId?: string; clients?: boolean; withInvoices?: ReturnType<typeof makeInvoice>[] } = {}) {
  const storage: InvoiceStorage = createInvoiceStorage(createMemoryStore(), { now: () => new Date(2026, 9, 14, 10, 0) });
  const profile = options.profile ?? makeSeller();
  await storage.profile.save(profile);
  if (options.clients) await storage.clients.save(makeClient({ id: 'c1', name: 'Northwind Traders' }));
  for (const invoice of options.withInvoices ?? []) await storage.invoices.save(invoice);
  const onBack = vi.fn();
  const onIssued = vi.fn();
  render(
    <InvoiceEditor storage={storage} profile={profile} invoiceId={options.invoiceId} onBack={onBack} onIssued={onIssued} renderPdf={fakeRender} />,
  );
  await screen.findByRole('heading', { name: options.invoiceId ? 'Edit draft' : 'New invoice' });
  return { storage, onBack, onIssued, profile };
}

async function fillClient() {
  await userEvent.type(screen.getByLabelText('Client name'), 'Northwind Traders');
  await userEvent.type(screen.getByLabelText('Address line 1'), '4 MG Road');
  await userEvent.type(screen.getByLabelText('City'), 'Pune');
  await userEvent.selectOptions(screen.getByLabelText('State'), '27');
}

async function fillFirstItem(rate = '3000', quantity = '24') {
  const item = within(screen.getByRole('group', { name: 'Item 1' }));
  await userEvent.type(item.getByLabelText('Description'), 'Consulting');
  await userEvent.clear(item.getByLabelText('Quantity'));
  await userEvent.type(item.getByLabelText('Quantity'), quantity);
  await userEvent.type(item.getByLabelText('Rate (₹)'), rate);
}

describe('InvoiceEditor: opening', () => {
  it('starts a new invoice with the next number and today\'s date', async () => {
    await setup();
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0001');
    expect(screen.getByLabelText('Issue date')).toHaveValue('2026-10-14');
  });

  it('continues the numbering after existing invoices', async () => {
    await setup({ withInvoices: [makeInvoice({ id: 'a', number: '2026-27/0007' })] });
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0008');
  });

  it('offers saved clients and fills the form from one, including the place of supply', async () => {
    await setup({ clients: true });
    await userEvent.selectOptions(screen.getByLabelText('Client'), 'c1');
    expect(screen.getByLabelText('Client name')).toHaveValue('Northwind Traders');
    expect(screen.getByLabelText('Place of supply')).toHaveValue('27');
  });

  it('shows GST fields only for a regular seller', async () => {
    await setup();
    expect(screen.getByLabelText('Place of supply')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Item 1' })).getByLabelText('GST rate')).toBeInTheDocument();
  });

  it('hides the GST fields for an unregistered seller', async () => {
    await setup({ profile: makeSeller({ gstStatus: 'unregistered', gstin: undefined }) });
    expect(screen.queryByLabelText('Place of supply')).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Item 1' })).queryByLabelText('GST rate')).not.toBeInTheDocument();
  });

  it('renumbers when the issue date moves into a new financial year, until the number is typed by hand', async () => {
    await setup();
    const date = screen.getByLabelText('Issue date');
    await userEvent.clear(date);
    await userEvent.type(date, '2027-04-02');
    await waitFor(() => expect(screen.getByLabelText('Invoice number')).toHaveValue('2027-28/0001'));
    await userEvent.clear(screen.getByLabelText('Invoice number'));
    await userEvent.type(screen.getByLabelText('Invoice number'), 'MINE-1');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-05-01');
    expect(screen.getByLabelText('Invoice number')).toHaveValue('MINE-1');
  });
});

describe('InvoiceEditor: totals and preview', () => {
  it('shows live totals once the invoice is complete', async () => {
    await setup();
    expect(screen.getByText('Fill in the details above to see the totals.')).toBeInTheDocument();
    await fillClient();
    await fillFirstItem();
    const list = await screen.findByRole('list', { name: 'Totals' });
    expect(within(list).getByText('₹84,960.00')).toBeInTheDocument();
    expect(screen.getByText('Eighty-Four Thousand Nine Hundred Sixty Rupees Only')).toBeInTheDocument();
  });

  it('shows the preview only after it is switched on, and only for a valid invoice', async () => {
    await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Show preview' }));
    expect(screen.getByText('Fill in the details to see the preview.')).toBeInTheDocument();
    await fillClient();
    await fillFirstItem();
    expect(await screen.findByTitle('Invoice preview', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('download', 'Tax-Invoice-2026-27-0001.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'Hide preview' }));
    expect(screen.queryByTitle('Invoice preview')).not.toBeInTheDocument();
  });
});

describe('InvoiceEditor: saving a draft', () => {
  it('saves a draft and the client, and says so', async () => {
    const { storage } = await setup();
    await fillClient();
    await fillFirstItem();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
    const [saved] = await storage.invoices.list();
    expect(saved).toMatchObject({ status: 'draft', number: '2026-27/0001', client: { name: 'Northwind Traders' } });
    expect((await storage.clients.list()).map((client) => client.name)).toEqual(['Northwind Traders']);
  });

  it('does not save the client when the box is unticked', async () => {
    const { storage } = await setup();
    await fillClient();
    await fillFirstItem();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Save this client for next time' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    expect(await storage.clients.list()).toEqual([]);
  });

  it('can save an incomplete draft, but not one with unreadable numbers', async () => {
    const { storage } = await setup();
    const item = within(screen.getByRole('group', { name: 'Item 1' }));
    await userEvent.type(item.getByLabelText('Rate (₹)'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await storage.invoices.list()).toEqual([]);
    expect(item.getByLabelText('Rate (₹)')).toHaveAttribute('aria-invalid', 'true');
    await userEvent.clear(item.getByLabelText('Rate (₹)'));
    await userEvent.type(item.getByLabelText('Rate (₹)'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
    expect((await storage.invoices.list())).toHaveLength(1);
  });

  it('reports a number that is already used', async () => {
    const taken = makeInvoice({ id: 'other', number: 'FIXED-1' });
    await setup({ withInvoices: [taken] });
    await userEvent.clear(screen.getByLabelText('Invoice number'));
    await userEvent.type(screen.getByLabelText('Invoice number'), 'FIXED-1');
    await fillFirstItem();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('That invoice number is already used. Choose another.')).toBeInTheDocument();
    expect(screen.getByLabelText('Invoice number')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows "Back to invoices" and calls onBack', async () => {
    const { onBack } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Back to invoices' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('InvoiceEditor: issuing', () => {
  it('issues a complete invoice, saves it and reports its id', async () => {
    const { storage, onIssued } = await setup();
    await fillClient();
    await fillFirstItem();
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    await waitFor(() => expect(onIssued).toHaveBeenCalledOnce());
    const [saved] = await storage.invoices.list();
    expect(saved).toMatchObject({ id: onIssued.mock.calls[0]?.[0], status: 'issued', number: '2026-27/0001' });
    expect((await storage.clients.list()).map((client) => client.name)).toEqual(['Northwind Traders']);
  });

  it('lists what is missing instead of issuing an incomplete invoice, and focuses the first problem', async () => {
    const { storage, onIssued } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    const summary = await screen.findByRole('alert', { name: undefined, description: undefined } as never).catch(() => null);
    expect(summary === null || summary !== undefined).toBe(true);
    expect(await screen.findByText(/Fix \d+ things before you issue this invoice/)).toBeInTheDocument();
    expect(onIssued).not.toHaveBeenCalled();
    expect(await storage.invoices.list()).toEqual([]);
    await waitFor(() => expect(screen.getByLabelText('Client name')).toHaveFocus());
    expect(screen.getByLabelText('Client name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps the errors up to date as the user fixes things', async () => {
    await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    await screen.findByText(/Fix \d+ things before you issue this invoice/);
    await userEvent.type(screen.getByLabelText('Client name'), 'Northwind');
    expect(screen.getByLabelText('Client name')).not.toHaveAttribute('aria-invalid');
  });

  it('issues an unregistered seller\'s invoice without any GST details', async () => {
    const { storage, onIssued } = await setup({ profile: makeSeller({ gstStatus: 'unregistered', gstin: undefined }) });
    await userEvent.type(screen.getByLabelText('Client name'), 'Local Client');
    await userEvent.type(screen.getByLabelText('Address line 1'), '1 Main Road');
    await userEvent.type(screen.getByLabelText('City'), 'Pune');
    await fillFirstItem('5000', '1');
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    await waitFor(() => expect(onIssued).toHaveBeenCalledOnce());
    const [saved] = await storage.invoices.list();
    expect(saved?.lines[0]?.gstRate).toBeUndefined();
  });

  it('issues an export in dollars', async () => {
    const { storage, onIssued } = await setup();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Client is outside India (export)' }));
    await userEvent.type(screen.getByLabelText('Client name'), 'Acme Inc');
    await userEvent.type(screen.getByLabelText('Address line 1'), '1 Main St');
    await userEvent.type(screen.getByLabelText('City'), 'Austin');
    await userEvent.clear(screen.getByLabelText('Country'));
    await userEvent.type(screen.getByLabelText('Country'), 'United States');
    await fillFirstItem('1234.56', '1');
    expect(within(screen.getByRole('group', { name: 'Item 1' })).getByLabelText('Rate ($)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    await waitFor(() => expect(onIssued).toHaveBeenCalledOnce());
    const [saved] = await storage.invoices.list();
    expect(saved).toMatchObject({ currency: 'USD', isExport: true });
    expect(saved?.lines[0]?.rate).toBe(123456);
  });
});

describe('InvoiceEditor: editing a draft', () => {
  it('opens a saved draft with its values and keeps its number', async () => {
    const draft = makeInvoice({ id: 'd1', number: '2026-27/0005', status: 'draft', notes: 'Hello' });
    const { storage } = await setup({ invoiceId: 'd1', withInvoices: [draft] });
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0005');
    expect(screen.getByLabelText('Client name')).toHaveValue('Northwind Traders');
    expect(screen.getByLabelText('Notes')).toHaveValue('Hello');
    await userEvent.type(screen.getByLabelText('Notes'), ' world');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    expect((await storage.invoices.get('d1'))?.notes).toBe('Hello world');
    expect((await storage.invoices.list())).toHaveLength(1);
  });

  it('refuses to edit an issued invoice', async () => {
    const issued = makeInvoice({ id: 'i1', status: 'issued' });
    const storage = createInvoiceStorage(createMemoryStore());
    await storage.profile.save(makeSeller());
    await storage.invoices.save(issued);
    render(<InvoiceEditor storage={storage} profile={makeSeller()} invoiceId="i1" onBack={() => {}} onIssued={() => {}} renderPdf={fakeRender} />);
    expect(await screen.findByText('This invoice cannot be edited')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to invoices' })).toBeInTheDocument();
  });
});
```
Notes for the implementer on the tests above: the line that looks up an alert without a name (`const summary = await screen.findByRole('alert', ...)`) is noise from drafting: delete those two lines (`const summary...` and the following `expect(summary === null ...)`) and keep the assertions that follow. Also, a draft of `makeInvoice` already has `lines` with `gstRate: 18`, a Maharashtra client and valid fields, so the edit test needs no extra input.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- InvoiceEditor`
Expected: FAIL (cannot resolve `./InvoiceEditor`).

- [ ] **Step 3: Implement the styles**

`apps/web/src/invoice/InvoiceEditor.module.css`:
```css
.editor {
  display: grid;
  gap: 1.5rem;
}

.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.layout {
  display: grid;
  gap: 2rem;
  grid-template-columns: minmax(0, 1fr);
}

@media (min-width: 64rem) {
  .layout {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
    align-items: start;
  }

  .aside {
    position: sticky;
    top: 5rem;
  }
}

.form,
.aside {
  display: grid;
  gap: 1.75rem;
  min-width: 0;
}

.section {
  display: grid;
  gap: 1rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.sectionTitle {
  padding: 0;
  font-family: var(--ff-display);
  font-size: 1.25rem;
  font-weight: 700;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.status {
  color: var(--text-muted);
}

.summary ul {
  margin: 0.4rem 0 0;
  padding-left: 1.2rem;
}

.preview {
  display: grid;
  gap: 0.75rem;
}
```

- [ ] **Step 4: Implement the editor**

`apps/web/src/invoice/InvoiceEditor.tsx`:
```tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  InvoiceNotValidError,
  InvoiceNumberTakenError,
  PRESET_THEMES,
  buildInvoiceDocument,
  issueInvoice,
  resolveTheme,
  type Client,
  type InvoiceDocument,
  type InvoiceRecord,
  type InvoiceStorage,
  type InvoiceTheme,
  type Issue,
  type SellerProfile,
} from '@solokit/tool-invoice';
import { Button, Notice } from '@solokit/ui';
import { ClientSection } from './ClientSection';
import { clientToForm, emptyClientForm, isBlankClient } from './clientFormState';
import { DetailsSection } from './DetailsSection';
import { editorToInvoice, invoiceToEditor, newEditorState, taxApplies, todayIso, validateEditor, type EditorState } from './editorModel';
import { newId } from './ids';
import { LineItemsEditor } from './LineItemsEditor';
import { PdfPreview } from './PdfPreview';
import { issuesByField } from './profileFormState';
import { TotalsPanel } from './TotalsPanel';
import { defaultPdfRenderer, usePdfPreview, type PdfRenderer } from './usePdfPreview';
import styles from './InvoiceEditor.module.css';

export interface InvoiceEditorProps {
  storage: InvoiceStorage;
  profile: SellerProfile;
  /** An existing draft to edit. A new invoice is started when this is absent. */
  invoiceId?: string | undefined;
  onBack: () => void;
  onIssued: (id: string) => void;
  renderPdf?: PdfRenderer;
}

type Loaded = { kind: 'ready'; clients: Client[]; customThemes: InvoiceTheme[] } | { kind: 'cannot-edit' } | { kind: 'failed' };

const NUMBER_TAKEN = 'That invoice number is already used. Choose another.';

/** Mirrors `pdfFilename` in the PDF package without loading it. */
export function invoiceFileName(invoice: InvoiceRecord): string {
  const { title, number } = buildInvoiceDocument(invoice);
  const safeNumber = number.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'invoice';
  return `${title.replace(/\s+/g, '-')}-${safeNumber}.pdf`;
}

function safeDocument(invoice: InvoiceRecord | null): InvoiceDocument | null {
  if (!invoice) return null;
  try {
    return buildInvoiceDocument(invoice);
  } catch (error) {
    console.error('Could not build the invoice totals', error);
    return null;
  }
}

export function InvoiceEditor({ storage, profile, invoiceId, onBack, onIssued, renderPdf = defaultPdfRenderer }: InvoiceEditorProps) {
  const isNew = invoiceId === undefined;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [serverIssues, setServerIssues] = useState<Issue[]>([]);
  const [savedMessage, setSavedMessage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [clients, settings, customThemes, existing] = await Promise.all([
        storage.clients.list(),
        storage.settings.get(),
        storage.themes.list(),
        invoiceId ? storage.invoices.get(invoiceId) : Promise.resolve(undefined),
      ]);
      if (cancelled) return;
      if (invoiceId) {
        if (!existing || existing.status !== 'draft') {
          setLoaded({ kind: 'cannot-edit' });
          return;
        }
        setState(invoiceToEditor(existing));
      } else {
        const today = todayIso(new Date());
        const number = await storage.invoices.nextNumber(today);
        if (cancelled) return;
        setState(
          newEditorState({ invoiceId: newId(), clientId: newId(), lineId: newId(), number, today, profile, defaultThemeId: settings.defaultThemeId }),
        );
      }
      setLoaded({ kind: 'ready', clients, customThemes });
    })().catch((error: unknown) => {
      console.error('Could not open the invoice editor', error);
      if (!cancelled) setLoaded({ kind: 'failed' });
    });
    return () => {
      cancelled = true;
    };
  }, [storage, invoiceId, profile]);

  // A new invoice's number follows the issue date's financial year until it is typed by hand.
  const issueDate = state?.issueDate;
  const numberEdited = state?.numberEdited;
  useEffect(() => {
    if (!isNew || issueDate === undefined || numberEdited) return;
    let cancelled = false;
    storage.invoices
      .nextNumber(issueDate)
      .then((number) => {
        if (!cancelled) setState((current) => (current && !current.numberEdited && current.issueDate === issueDate ? { ...current, number } : current));
      })
      .catch(() => {
        // An invalid or half-typed date: keep the current number.
      });
    return () => {
      cancelled = true;
    };
  }, [storage, isNew, issueDate, numberEdited]);

  const change = useCallback((patch: Partial<EditorState>) => {
    setSavedMessage(false);
    setServerIssues([]);
    setState((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const customThemes = loaded?.kind === 'ready' ? loaded.customThemes : [];
  const themes = useMemo(() => [...PRESET_THEMES, ...customThemes], [customThemes]);

  const built = useMemo(() => (state ? editorToInvoice(state, profile, new Date()) : null), [state, profile]);
  const issues = useMemo(() => (state ? validateEditor(state, profile, new Date()) : []), [state, profile]);
  const errors = useMemo(() => issuesByField([...(showErrors ? issues : []), ...serverIssues]), [showErrors, issues, serverIssues]);
  const previewInvoice = issues.length === 0 && built ? built.invoice : null;
  const theme = useMemo(() => resolveTheme(state?.themeId ?? 'classic', customThemes), [state?.themeId, customThemes]);
  const preview = usePdfPreview({ invoice: previewInvoice, theme, enabled: showPreview, render: renderPdf });
  const document = useMemo(() => safeDocument(previewInvoice), [previewInvoice]);

  if (loaded === null || state === null) {
    if (loaded?.kind === 'cannot-edit' || loaded?.kind === 'failed') return renderProblem(loaded.kind, onBack);
    return <p>Opening the invoice…</p>;
  }
  if (loaded.kind !== 'ready') return renderProblem(loaded.kind, onBack);

  const taxed = taxApplies(state, profile);
  const clientErrors = errors;

  function focusFirstProblem() {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  async function persistClient(invoice: InvoiceRecord) {
    if (state && state.saveClient && !isBlankClient(state.client)) await storage.clients.save(invoice.client);
  }

  async function handleSave(issue: boolean) {
    if (!state || !built || busy) return;
    setShowErrors(true);
    setSavedMessage(false);
    setServerIssues([]);
    if (issue ? issues.length > 0 : built.parseIssues.length > 0) {
      focusFirstProblem();
      return;
    }
    setBusy(true);
    try {
      if (issue) {
        const issued = issueInvoice(built.invoice);
        await persistClient(issued);
        const saved = await storage.invoices.save(issued);
        onIssued(saved.id);
        return;
      }
      const saved = await storage.invoices.save(built.invoice);
      await persistClient(saved);
      setState((current) => (current ? { ...current, createdAt: saved.createdAt } : current));
      setSavedMessage(true);
    } catch (error) {
      if (error instanceof InvoiceNumberTakenError) {
        setServerIssues([{ path: 'number', message: NUMBER_TAKEN }]);
        focusFirstProblem();
      } else if (error instanceof InvoiceNotValidError) {
        setShowErrors(true);
        focusFirstProblem();
      } else {
        console.error('Could not save the invoice', error);
        setServerIssues([{ path: 'save', message: 'The invoice could not be saved. Please try again.' }]);
      }
    } finally {
      setBusy(false);
    }
  }

  const shownIssues = [...(showErrors ? issues : []), ...serverIssues];

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <h2 style={{ fontSize: '1.8rem' }}>{isNew ? 'New invoice' : 'Edit draft'}</h2>
        <Button variant="secondary" onClick={onBack}>
          Back to invoices
        </Button>
      </div>

      <div className={styles.layout}>
        <div className={styles.form} ref={formRef}>
          {shownIssues.length > 0 ? (
            <div className={styles.summary}>
              <Notice tone="danger" title={`Fix ${shownIssues.length} ${shownIssues.length === 1 ? 'thing' : 'things'} before you issue this invoice`}>
                <ul>
                  {shownIssues.map((issue) => (
                    <li key={`${issue.path}-${issue.message}`}>{issue.message}</li>
                  ))}
                </ul>
              </Notice>
            </div>
          ) : null}

          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>Client</legend>
            <ClientSection
              value={state.client}
              clientId={state.clientId}
              savedClients={loaded.clients}
              isExport={state.isExport}
              saveClient={state.saveClient}
              errors={clientErrors}
              onChange={(client) =>
                change({
                  client,
                  ...(!state.placeEdited && !state.isExport ? { placeOfSupplyStateCode: client.stateCode } : {}),
                })
              }
              onSelectClient={(client) =>
                change(
                  client
                    ? {
                        clientId: client.id,
                        client: clientToForm(client),
                        saveClient: true,
                        ...(!state.placeEdited && !state.isExport ? { placeOfSupplyStateCode: client.address.stateCode ?? '' } : {}),
                      }
                    : { clientId: newId(), client: emptyClientForm(), saveClient: true },
                )
              }
              onSaveClientChange={(saveClient) => change({ saveClient })}
            />
          </fieldset>

          <DetailsSection state={state} onChange={change} profile={profile} themes={themes} errors={errors} />

          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>Items</legend>
            <LineItemsEditor
              lines={state.lines}
              onChange={(lines) => change({ lines })}
              taxApplies={taxed}
              currency={state.isExport ? state.currency : 'INR'}
              issueDate={state.issueDate}
              profile={profile}
              errors={errors}
            />
          </fieldset>

          <div className={styles.actions}>
            <Button variant="secondary" disabled={busy} onClick={() => void handleSave(false)}>
              Save draft
            </Button>
            <Button disabled={busy} onClick={() => void handleSave(true)}>
              Issue invoice
            </Button>
            {savedMessage ? (
              <span className={styles.status} role="status">
                Draft saved
              </span>
            ) : null}
          </div>
          {errors['save'] ? <Notice tone="danger">{errors['save']}</Notice> : null}
        </div>

        <aside className={styles.aside} aria-label="Totals and preview">
          <TotalsPanel document={document} />
          <section className={styles.preview} aria-labelledby="preview-heading">
            <div className={styles.header}>
              <h3 id="preview-heading" style={{ fontSize: '1.25rem' }}>
                Preview
              </h3>
              <Button variant="secondary" onClick={() => setShowPreview((shown) => !shown)}>
                {showPreview ? 'Hide preview' : 'Show preview'}
              </Button>
            </div>
            {showPreview ? (
              <PdfPreview
                state={preview}
                filename={previewInvoice ? invoiceFileName(previewInvoice) : 'invoice.pdf'}
                onRetry={preview.retry}
                placeholder="Fill in the details to see the preview."
              />
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

function renderProblem(kind: 'cannot-edit' | 'failed', onBack: () => void) {
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Notice tone="danger" title={kind === 'cannot-edit' ? 'This invoice cannot be edited' : 'The invoice could not be opened'}>
        {kind === 'cannot-edit'
          ? 'Only drafts can be edited. Issued invoices are locked so their numbers stay reliable. You can duplicate one as a new draft instead.'
          : 'Your browser could not read what was saved on this device. Go back and try again.'}
      </Notice>
      <div>
        <Button onClick={onBack}>Back to invoices</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @solokit/web test -- InvoiceEditor`
Expected: PASS.
These tests drive many fields; if one is flaky because of timing (the number-follows-date effect and the debounce), wait with `waitFor` instead of asserting immediately. Do not weaken what is asserted. If `act` warnings appear, wrap the asynchronous state updates in `waitFor`. `fillClient` uses the `State` select, which exists only for domestic clients.
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): add the invoice editor screen

```

---

### Task 9: Invoice list and viewer

**Files:**
- Create: `apps/web/src/invoice/InvoiceList.tsx`, `InvoiceList.module.css`, `InvoiceViewer.tsx`
- Test: `apps/web/src/invoice/InvoiceList.test.tsx`, `InvoiceViewer.test.tsx`

**Interfaces:**
- `InvoiceList({ storage, onNew, onEdit, onView, renderPdf })`:
  - Loads `storage.invoices.list()` (newest first). Shows "Opening your invoices…" while loading and a danger notice with "Try again" on failure.
  - Empty: a message "No invoices yet." with a button "Create your first invoice" (calls `onNew`).
  - Otherwise a list (`<ul aria-label="Invoices">`); each item shows the number, the client name, the issue date (formatted with `formatIsoDate`), a status badge ("Draft", "Issued", "Cancelled") and the total (the `Total` row of `buildInvoiceDocument(invoice).totals`, or "–" when it cannot be built), and these buttons (accessible names include the number): "Open" for every invoice (`onEdit(id)` for drafts, `onView(id)` otherwise), "Download PDF" (renders on demand with `renderPdf` and `downloadBlob`, with a small "Preparing…" state and an inline error), "Duplicate" (saves a new draft with the next number and today's date, then calls `onEdit(newId)`), "Cancel invoice" (issued only; two steps: first click shows "Cancel invoice 2026-27/0001? Its number stays used." with "Yes, cancel invoice" and "Keep it"), and "Delete draft" (drafts only; two steps: "Delete draft X? This cannot be undone." with "Yes, delete draft" and "Keep it").
  - The header has a "New invoice" button (`onNew`).
- `InvoiceViewer({ storage, invoiceId, onBack, onEdit, renderPdf })`: loads the invoice and custom themes; shows the number, status badge, a short summary (client, date, total), buttons "Back to invoices", "Duplicate as new draft" (like Duplicate in the list), and "Cancel invoice" (issued only, two steps); and the `PdfPreview` (enabled; filename from `invoiceFileName`). A draft opened here is redirected: shows "This invoice is a draft" with a button "Edit draft" (`onEdit(id)`). A missing invoice shows "That invoice was not found".

- [ ] **Step 1: Write the failing tests**

`apps/web/src/invoice/InvoiceList.test.tsx`:
```tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createInvoiceStorage, type InvoiceStorage } from '@solokit/tool-invoice';
import { makeClient, makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { InvoiceList } from './InvoiceList';
import type { PdfRenderer } from './usePdfPreview';

afterEach(() => vi.restoreAllMocks());

const pdf = new Blob(['pdf'], { type: 'application/pdf' });

async function setup(invoices: ReturnType<typeof makeInvoice>[] = [], renderPdf?: PdfRenderer) {
  const storage: InvoiceStorage = createInvoiceStorage(createMemoryStore(), { now: () => new Date(2026, 9, 14, 10, 0) });
  await storage.profile.save(makeSeller());
  for (const invoice of invoices) await storage.invoices.save(invoice);
  const handlers = { onNew: vi.fn(), onEdit: vi.fn(), onView: vi.fn() };
  render(<InvoiceList storage={storage} {...handlers} renderPdf={renderPdf ?? (async () => pdf)} />);
  return { storage, ...handlers };
}

const issued = makeInvoice({ id: 'i1', number: '2026-27/0001', status: 'issued', issueDate: '2026-10-14' });
const draft = makeInvoice({ id: 'd1', number: '2026-27/0002', status: 'draft', issueDate: '2026-10-15', client: makeClient({ id: 'c2', name: 'Acme Co' }) });
const cancelled = makeInvoice({ id: 'x1', number: '2026-27/0003', status: 'cancelled', issueDate: '2026-10-16' });

describe('InvoiceList: showing invoices', () => {
  it('invites the user to create the first invoice when there are none', async () => {
    const { onNew } = await setup();
    expect(await screen.findByText('No invoices yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create your first invoice' }));
    expect(onNew).toHaveBeenCalledOnce();
  });

  it('lists invoices newest first with number, client, date, status and total', async () => {
    await setup([issued, draft, cancelled]);
    const list = await screen.findByRole('list', { name: 'Invoices' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('2026-27/0003');
    expect(items[2]).toHaveTextContent('2026-27/0001');
    expect(items[2]).toHaveTextContent('Northwind Traders');
    expect(items[2]).toHaveTextContent('14 Oct 2026');
    expect(items[2]).toHaveTextContent('Issued');
    expect(items[2]).toHaveTextContent('₹84,960.00');
    expect(items[1]).toHaveTextContent('Draft');
    expect(items[1]).toHaveTextContent('Acme Co');
    expect(items[0]).toHaveTextContent('Cancelled');
  });

  it('shows a dash instead of a total that cannot be worked out', async () => {
    const broken = makeInvoice({ id: 'b1', number: '2026-27/0009', status: 'draft', lines: [] });
    await setup([broken]);
    const item = (await screen.findAllByRole('listitem'))[0]!;
    expect(item).toHaveTextContent('–');
  });

  it('has a New invoice button', async () => {
    const { onNew } = await setup([issued]);
    await userEvent.click(await screen.findByRole('button', { name: 'New invoice' }));
    expect(onNew).toHaveBeenCalledOnce();
  });
});

describe('InvoiceList: opening', () => {
  it('opens drafts in the editor and issued invoices in the viewer', async () => {
    const { onEdit, onView } = await setup([issued, draft]);
    await userEvent.click(await screen.findByRole('button', { name: 'Open 2026-27/0002' }));
    expect(onEdit).toHaveBeenCalledWith('d1');
    await userEvent.click(screen.getByRole('button', { name: 'Open 2026-27/0001' }));
    expect(onView).toHaveBeenCalledWith('i1');
  });
});

describe('InvoiceList: downloading', () => {
  it('builds the PDF on demand and saves it under its file name', async () => {
    const clicks: string[] = [];
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    const renderPdf = vi.fn<PdfRenderer>().mockResolvedValue(pdf);
    await setup([issued], renderPdf);
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF 2026-27/0001' }));
    await waitFor(() => expect(clicks).toEqual(['Tax-Invoice-2026-27-0001.pdf']));
    expect(renderPdf).toHaveBeenCalledOnce();
    expect(renderPdf.mock.calls[0]?.[0].invoice.id).toBe('i1');
    expect(renderPdf.mock.calls[0]?.[0].theme.id).toBe('classic');
  });

  it('says so when the PDF cannot be built', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await setup([issued], async () => {
      throw new Error('boom');
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF 2026-27/0001' }));
    expect(await screen.findByText('The PDF could not be built. Try again.')).toBeInTheDocument();
  });
});

describe('InvoiceList: duplicating', () => {
  it('copies an invoice into a new draft with the next number and opens it', async () => {
    const { storage, onEdit } = await setup([issued]);
    await userEvent.click(await screen.findByRole('button', { name: 'Duplicate 2026-27/0001' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
    const all = await storage.invoices.list();
    expect(all).toHaveLength(2);
    const copy = all.find((invoice) => invoice.id !== 'i1');
    expect(copy).toMatchObject({ status: 'draft', number: '2026-27/0002', issueDate: '2026-10-14' });
    expect(onEdit).toHaveBeenCalledWith(copy?.id);
  });
});

describe('InvoiceList: cancelling and deleting', () => {
  it('cancels an issued invoice only after a second click, and keeps it in the list', async () => {
    const { storage } = await setup([issued]);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel invoice 2026-27/0001' }));
    expect(screen.getByText('Cancel invoice 2026-27/0001? Its number stays used.')).toBeInTheDocument();
    expect((await storage.invoices.get('i1'))?.status).toBe('issued');
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel invoice' }));
    await waitFor(async () => expect((await storage.invoices.get('i1'))?.status).toBe('cancelled'));
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
  });

  it('can back out of cancelling', async () => {
    const { storage } = await setup([issued]);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel invoice 2026-27/0001' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByText(/Its number stays used/)).not.toBeInTheDocument();
    expect((await storage.invoices.get('i1'))?.status).toBe('issued');
  });

  it('offers cancel only for issued invoices and delete only for drafts', async () => {
    await setup([issued, draft, cancelled]);
    await screen.findByRole('list', { name: 'Invoices' });
    expect(screen.getByRole('button', { name: 'Cancel invoice 2026-27/0001' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel invoice 2026-27/0002' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel invoice 2026-27/0003' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete draft 2026-27/0002' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete draft 2026-27/0001' })).not.toBeInTheDocument();
  });

  it('deletes a draft after a second click', async () => {
    const { storage } = await setup([draft]);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete draft 2026-27/0002' }));
    expect(screen.getByText('Delete draft 2026-27/0002? This cannot be undone.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete draft' }));
    await waitFor(async () => expect(await storage.invoices.get('d1')).toBeUndefined());
    expect(await screen.findByText('No invoices yet.')).toBeInTheDocument();
  });
});
```

`apps/web/src/invoice/InvoiceViewer.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createInvoiceStorage, type InvoiceStorage } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { InvoiceViewer } from './InvoiceViewer';
import type { PdfRenderer } from './usePdfPreview';

beforeEach(() => {
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:view'), revokeObjectURL: vi.fn() });
});

const fakeRender: PdfRenderer = async () => new Blob(['pdf'], { type: 'application/pdf' });

async function setup(invoice: ReturnType<typeof makeInvoice> | null, id = 'i1') {
  const storage: InvoiceStorage = createInvoiceStorage(createMemoryStore(), { now: () => new Date(2026, 9, 14, 10, 0) });
  await storage.profile.save(makeSeller());
  if (invoice) await storage.invoices.save(invoice);
  const handlers = { onBack: vi.fn(), onEdit: vi.fn() };
  render(<InvoiceViewer storage={storage} invoiceId={id} {...handlers} renderPdf={fakeRender} />);
  return { storage, ...handlers };
}

describe('InvoiceViewer', () => {
  it('shows an issued invoice with its preview, download link and actions', async () => {
    await setup(makeInvoice({ id: 'i1', status: 'issued' }));
    expect(await screen.findByRole('heading', { name: '2026-27/0001' })).toBeInTheDocument();
    expect(screen.getByText('Issued')).toBeInTheDocument();
    expect(screen.getByText(/Northwind Traders/)).toBeInTheDocument();
    expect(await screen.findByTitle('Invoice preview', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('download', 'Tax-Invoice-2026-27-0001.pdf');
    expect(screen.getByRole('button', { name: 'Duplicate as new draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel invoice' })).toBeInTheDocument();
  });

  it('goes back to the list', async () => {
    const { onBack } = await setup(makeInvoice({ id: 'i1', status: 'issued' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Back to invoices' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('cancels an invoice after a second click and then offers no more cancelling', async () => {
    const { storage } = await setup(makeInvoice({ id: 'i1', status: 'issued' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel invoice' }));
    expect(screen.getByText('Cancel this invoice? Its number stays used.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel invoice' }));
    await waitFor(async () => expect((await storage.invoices.get('i1'))?.status).toBe('cancelled'));
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel invoice' })).not.toBeInTheDocument();
  });

  it('duplicates into a new draft and opens it', async () => {
    const { storage, onEdit } = await setup(makeInvoice({ id: 'i1', status: 'issued' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Duplicate as new draft' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
    const copy = (await storage.invoices.list()).find((invoice) => invoice.id !== 'i1');
    expect(copy).toMatchObject({ status: 'draft', number: '2026-27/0002' });
  });

  it('sends a draft to the editor instead of showing it', async () => {
    const { onEdit } = await setup(makeInvoice({ id: 'd1', status: 'draft' }), 'd1');
    expect(await screen.findByText('This invoice is a draft')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit draft' }));
    expect(onEdit).toHaveBeenCalledWith('d1');
  });

  it('says so when the invoice does not exist', async () => {
    await setup(null, 'missing');
    expect(await screen.findByText('That invoice was not found')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/web test -- InvoiceList InvoiceViewer`
Expected: FAIL (missing modules).

- [ ] **Step 3: Implement the list**

`apps/web/src/invoice/InvoiceList.module.css`:
```css
.list {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: grid;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-m);
}

.top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.number {
  font-family: var(--ff-mono);
  font-weight: 700;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  color: var(--text-muted);
}

.total {
  margin-left: auto;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.confirm {
  display: grid;
  gap: 0.6rem;
}

.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
```

`apps/web/src/invoice/InvoiceList.tsx`:
```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  buildInvoiceDocument,
  resolveTheme,
  type InvoiceRecord,
  type InvoiceStorage,
  type InvoiceTheme,
} from '@solokit/tool-invoice';
import { Badge, Button, Notice, formatIsoDate } from '@solokit/ui';
import { downloadBlob } from './downloads';
import { duplicateInvoice, todayIso } from './editorModel';
import { newId } from './ids';
import { invoiceFileName } from './InvoiceEditor';
import { defaultPdfRenderer, type PdfRenderer } from './usePdfPreview';
import styles from './InvoiceList.module.css';

export interface InvoiceListProps {
  storage: InvoiceStorage;
  onNew: () => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  renderPdf?: PdfRenderer;
}

type Pending = { id: string; action: 'cancel' | 'delete' } | null;

export function totalOf(invoice: InvoiceRecord): string {
  try {
    const rows = buildInvoiceDocument(invoice).totals;
    return rows.find((row) => row.emphasis === 'total')?.amount ?? '–';
  } catch {
    return '–';
  }
}

export function StatusBadge({ status }: { status: InvoiceRecord['status'] }) {
  if (status === 'issued') return <Badge tone="success">Issued</Badge>;
  if (status === 'cancelled') return <Badge tone="soon">Cancelled</Badge>;
  return <Badge>Draft</Badge>;
}

export function InvoiceList({ storage, onNew, onEdit, onView, renderPdf = defaultPdfRenderer }: InvoiceListProps) {
  const [invoices, setInvoices] = useState<InvoiceRecord[] | null>(null);
  const [customThemes, setCustomThemes] = useState<InvoiceTheme[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string } | null>(null);

  const reload = useCallback(async () => {
    const [list, themes] = await Promise.all([storage.invoices.list(), storage.themes.list()]);
    setInvoices(list);
    setCustomThemes(themes);
  }, [storage]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    reload().catch((error: unknown) => {
      console.error('Could not read the invoices', error);
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [reload, attempt]);

  async function download(invoice: InvoiceRecord) {
    setBusy(invoice.id);
    setMessage(null);
    try {
      const blob = await renderPdf({ invoice, theme: resolveTheme(invoice.themeId, customThemes) });
      downloadBlob(blob, invoiceFileName(invoice));
    } catch (error) {
      console.error('Could not build the invoice PDF', error);
      setMessage({ id: invoice.id, text: 'The PDF could not be built. Try again.' });
    } finally {
      setBusy(null);
    }
  }

  async function duplicate(invoice: InvoiceRecord) {
    setBusy(invoice.id);
    setMessage(null);
    try {
      const today = todayIso(new Date());
      const copy = duplicateInvoice(invoice, { id: newId(), number: await storage.invoices.nextNumber(today), issueDate: today });
      const saved = await storage.invoices.save(copy);
      onEdit(saved.id);
    } catch (error) {
      console.error('Could not duplicate the invoice', error);
      setMessage({ id: invoice.id, text: 'The invoice could not be duplicated. Try again.' });
      setBusy(null);
    }
  }

  async function confirm(invoice: InvoiceRecord, action: 'cancel' | 'delete') {
    setBusy(invoice.id);
    setMessage(null);
    try {
      if (action === 'cancel') await storage.invoices.cancel(invoice.id);
      else await storage.invoices.remove(invoice.id);
      setPending(null);
      await reload();
    } catch (error) {
      console.error('Could not change the invoice', error);
      setMessage({ id: invoice.id, text: 'That could not be done. Try again.' });
    } finally {
      setBusy(null);
    }
  }

  if (failed) {
    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <Notice tone="danger" title="Your invoices could not be opened">
          Your browser could not read what was saved on this device.
        </Notice>
        <div>
          <Button onClick={() => setAttempt((count) => count + 1)}>Try again</Button>
        </div>
      </div>
    );
  }
  if (invoices === null) return <p>Opening your invoices…</p>;

  if (invoices.length === 0) {
    return (
      <div style={{ display: 'grid', gap: '1rem', justifyItems: 'start' }}>
        <p>No invoices yet.</p>
        <Button onClick={onNew}>Create your first invoice</Button>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.header}>
        <h2 style={{ fontSize: '1.8rem' }}>Invoices</h2>
        <Button onClick={onNew}>New invoice</Button>
      </div>
      <ul className={styles.list} aria-label="Invoices" role="list">
        {invoices.map((invoice) => {
          const isPending = pending?.id === invoice.id;
          return (
            <li key={invoice.id} className={styles.item}>
              <div className={styles.top}>
                <span className={styles.number}>{invoice.number}</span>
                <StatusBadge status={invoice.status} />
              </div>
              <div className={styles.meta}>
                <span>{invoice.client.name}</span>
                <span>{formatIsoDate(invoice.issueDate)}</span>
                <span className={styles.total}>{totalOf(invoice)}</span>
              </div>
              {isPending && pending ? (
                <div className={styles.confirm}>
                  <p>
                    {pending.action === 'cancel'
                      ? `Cancel invoice ${invoice.number}? Its number stays used.`
                      : `Delete draft ${invoice.number}? This cannot be undone.`}
                  </p>
                  <div className={styles.actions}>
                    <Button disabled={busy === invoice.id} onClick={() => void confirm(invoice, pending.action)}>
                      {pending.action === 'cancel' ? 'Yes, cancel invoice' : 'Yes, delete draft'}
                    </Button>
                    <Button variant="secondary" onClick={() => setPending(null)}>
                      Keep it
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={styles.actions}>
                  <Button variant="secondary" aria-label={`Open ${invoice.number}`} onClick={() => (invoice.status === 'draft' ? onEdit(invoice.id) : onView(invoice.id))}>
                    Open
                  </Button>
                  <Button variant="secondary" aria-label={`Download PDF ${invoice.number}`} disabled={busy === invoice.id} onClick={() => void download(invoice)}>
                    {busy === invoice.id ? 'Preparing…' : 'Download PDF'}
                  </Button>
                  <Button variant="secondary" aria-label={`Duplicate ${invoice.number}`} disabled={busy === invoice.id} onClick={() => void duplicate(invoice)}>
                    Duplicate
                  </Button>
                  {invoice.status === 'issued' ? (
                    <Button variant="ghost" aria-label={`Cancel invoice ${invoice.number}`} onClick={() => setPending({ id: invoice.id, action: 'cancel' })}>
                      Cancel invoice
                    </Button>
                  ) : null}
                  {invoice.status === 'draft' ? (
                    <Button variant="ghost" aria-label={`Delete draft ${invoice.number}`} onClick={() => setPending({ id: invoice.id, action: 'delete' })}>
                      Delete draft
                    </Button>
                  ) : null}
                </div>
              )}
              {message?.id === invoice.id ? <Notice tone="danger">{message.text}</Notice> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```
Importing `invoiceFileName` from `InvoiceEditor.tsx` creates a dependency of the list on the editor module. Move `invoiceFileName` (and `safeDocument` is not needed here) into a new file `apps/web/src/invoice/fileName.ts` that both import, and re-export nothing from the editor. Keep a test for it in `downloads.test.ts` (add a `describe('invoiceFileName')` with the same expectations as the PDF package's `pdfFilename` for three invoices: a regular seller, a composition seller and a proforma, expecting `Tax-Invoice-2026-27-0001.pdf`, `Bill-of-Supply-2026-27-0001.pdf` and `Proforma-Invoice-2026-27-0001.pdf`, and an odd number `'INV 1/'` giving `Tax-Invoice-INV-1.pdf`).

- [ ] **Step 4: Implement the viewer**

`apps/web/src/invoice/InvoiceViewer.tsx`:
```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { resolveTheme, type InvoiceRecord, type InvoiceStorage, type InvoiceTheme } from '@solokit/tool-invoice';
import { Button, Notice, formatIsoDate } from '@solokit/ui';
import { duplicateInvoice, todayIso } from './editorModel';
import { invoiceFileName } from './fileName';
import { newId } from './ids';
import { StatusBadge, totalOf } from './InvoiceList';
import { PdfPreview } from './PdfPreview';
import { defaultPdfRenderer, usePdfPreview, type PdfRenderer } from './usePdfPreview';

export interface InvoiceViewerProps {
  storage: InvoiceStorage;
  invoiceId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
  renderPdf?: PdfRenderer;
}

export function InvoiceViewer({ storage, invoiceId, onBack, onEdit, renderPdf = defaultPdfRenderer }: InvoiceViewerProps) {
  const [invoice, setInvoice] = useState<InvoiceRecord | null | undefined>(undefined);
  const [customThemes, setCustomThemes] = useState<InvoiceTheme[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([storage.invoices.get(invoiceId), storage.themes.list()])
      .then(([found, themes]) => {
        if (cancelled) return;
        setInvoice(found ?? null);
        setCustomThemes(themes);
      })
      .catch((failure: unknown) => {
        console.error('Could not open the invoice', failure);
        if (!cancelled) setInvoice(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storage, invoiceId]);

  const theme = useMemo(() => resolveTheme(invoice?.themeId ?? 'classic', customThemes), [invoice?.themeId, customThemes]);
  const preview = usePdfPreview({ invoice: invoice && invoice.status !== 'draft' ? invoice : null, theme, enabled: true, delayMs: 0, render: renderPdf });

  if (invoice === undefined) return <p>Opening the invoice…</p>;
  if (invoice === null) {
    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <Notice tone="danger" title="That invoice was not found">
          It may have been deleted. Go back to your invoices.
        </Notice>
        <div>
          <Button onClick={onBack}>Back to invoices</Button>
        </div>
      </div>
    );
  }
  if (invoice.status === 'draft') {
    return (
      <div style={{ display: 'grid', gap: '1rem', justifyItems: 'start' }}>
        <p>This invoice is a draft</p>
        <Button onClick={() => onEdit(invoice.id)}>Edit draft</Button>
      </div>
    );
  }

  const current = invoice;

  async function duplicate() {
    setBusy(true);
    setError(null);
    try {
      const today = todayIso(new Date());
      const copy = duplicateInvoice(current, { id: newId(), number: await storage.invoices.nextNumber(today), issueDate: today });
      const saved = await storage.invoices.save(copy);
      onEdit(saved.id);
    } catch (failure) {
      console.error('Could not duplicate the invoice', failure);
      setError('The invoice could not be duplicated. Try again.');
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      setInvoice(await storage.invoices.cancel(current.id));
      setConfirming(false);
    } catch (failure) {
      console.error('Could not cancel the invoice', failure);
      setError('The invoice could not be cancelled. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontFamily: 'var(--ff-mono)' }}>{current.number}</h2>
          <StatusBadge status={current.status} />
        </div>
        <Button variant="secondary" onClick={onBack}>
          Back to invoices
        </Button>
      </div>
      <p style={{ color: 'var(--text-muted)' }}>
        {current.client.name} · {formatIsoDate(current.issueDate)} · {totalOf(current)}
      </p>
      {confirming ? (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          <p>Cancel this invoice? Its number stays used.</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Button disabled={busy} onClick={() => void cancel()}>
              Yes, cancel invoice
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" disabled={busy} onClick={() => void duplicate()}>
            Duplicate as new draft
          </Button>
          {current.status === 'issued' ? (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              Cancel invoice
            </Button>
          ) : null}
        </div>
      )}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <PdfPreview state={preview} filename={invoiceFileName(current)} onRetry={preview.retry} placeholder="Building the preview…" />
    </div>
  );
}
```
Create `apps/web/src/invoice/fileName.ts`:
```ts
import { buildInvoiceDocument, type InvoiceRecord } from '@solokit/tool-invoice';

/** "Tax-Invoice-2026-27-0001.pdf". Mirrors `pdfFilename` in the PDF package without loading it. */
export function invoiceFileName(invoice: InvoiceRecord): string {
  const { title, number } = buildInvoiceDocument(invoice);
  const safeNumber = number.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'invoice';
  return `${title.replace(/\s+/g, '-')}-${safeNumber}.pdf`;
}
```
and in `InvoiceEditor.tsx` replace its local `invoiceFileName` export with `import { invoiceFileName } from './fileName';` (delete the local function). In `InvoiceList.tsx` import it from `./fileName` instead of `./InvoiceEditor`.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @solokit/web test -- InvoiceList InvoiceViewer downloads InvoiceEditor`
Expected: PASS.
Run: `pnpm --filter @solokit/web typecheck`
Expected: no errors.
Notes: the list buttons use `aria-label` with the invoice number so each is unique; the visible text stays short ("Open", "Download PDF"). `Button` forwards `aria-label` to the element (it spreads remaining props).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): add the invoice list and viewer with download, duplicate, cancel and delete

```

---

### Task 10: Put it all in the app, and make the invoice tool available

**Files:**
- Modify: `apps/web/src/invoice/InvoiceApp.tsx`, `InvoiceApp.test.tsx`
- Modify: `packages/registry/src/tools.ts`, `packages/registry/src/tools.test.ts`
- Modify: `apps/web/src/components/home.test.tsx` (and any test that expects the invoice tool to be "coming soon")

**Interfaces:**
- `InvoiceApp` views: `{ name: 'list' } | { name: 'new' } | { name: 'edit'; id: string } | { name: 'view'; id: string } | { name: 'profile' }`. The navigation (`<nav aria-label="Invoice tool">`) has three plain buttons: "Invoices" (current for `list` and `view`), "New invoice" (current for `new` and `edit`), "Profile". Issuing an invoice (`onIssued`) opens the viewer for it; "Back to invoices" returns to the list; the list's "New invoice"/"Create your first invoice" opens a new editor; `onEdit` opens the editor on that draft; `onView` opens the viewer. `InvoiceApp` accepts an optional `renderPdf?: PdfRenderer` prop that it passes down (used by tests).
- Registry: the invoice tool's status becomes `'available'`.

- [ ] **Step 1: Update the tests**

In `packages/registry/src/tools.test.ts` change/add:
```ts
  it('has the invoice generator available, and every other tool still coming soon', () => {
    const available = getAvailableTools().map((tool) => tool.slug);
    expect(available).toEqual(['invoice']);
    expect(getToolBySlug('invoice')?.status).toBe('available');
    expect(getToolBySlug('quote')?.status).toBe('coming-soon');
  });
```
(Remove the old vacuous "lists only available tools" assertion that mapped over an empty list, or fold it into this test.)

In `apps/web/src/components/home.test.tsx` the existing test "lists every registry tool, linking only the ones that are available" already branches on status: it must now find a link for the invoice tool. Strengthen it so the available branch is certain to run: add a separate test
```tsx
  it('links the invoice generator now that it is available', () => {
    render(<Home />);
    const section = screen.getByRole('region', { name: 'Tools' });
    expect(within(section).getByRole('link', { name: /Invoice generator/ })).toHaveAttribute('href', '/tools/invoice/');
    expect(within(section).getByText('Ready')).toBeInTheDocument();
  });
```
Search the rest of `apps/web` and `packages` for other tests that assume the invoice tool is coming soon (`grep -rn "Invoice generator" --include=*.test.*`), and update them.

Extend `apps/web/src/invoice/InvoiceApp.test.tsx` (keep the existing tests; add these inside new `describe` blocks; use `createInvoiceStorage(store).profile.save(makeSeller())` and `settings.update({ onboarded: true })` as in the existing seed helper, and pass `renderPdf` to `InvoiceApp`):
```tsx
describe('InvoiceApp: invoices', () => {
  const fakeRender = async () => new Blob(['pdf'], { type: 'application/pdf' });

  async function openApp(invoices: ReturnType<typeof makeInvoice>[] = []) {
    const store = createMemoryStore();
    await seedProfile(store);
    const storage = createInvoiceStorage(store);
    for (const invoice of invoices) await storage.invoices.save(invoice);
    render(
      <StoreProvider factory={() => store}>
        <InvoiceApp renderPdf={fakeRender} />
      </StoreProvider>,
    );
    await screen.findByRole('navigation', { name: 'Invoice tool' });
    return { store, storage };
  }

  it('shows the invoice list first, with the navigation buttons', async () => {
    await openApp();
    expect(screen.getByRole('button', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'New invoice' })).not.toHaveAttribute('aria-current');
    expect(await screen.findByText('No invoices yet.')).toBeInTheDocument();
  });

  it('opens the editor from the list and from the navigation, and goes back', async () => {
    await openApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Create your first invoice' }));
    expect(await screen.findByRole('heading', { name: 'New invoice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New invoice', current: 'page' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to invoices' }));
    expect(await screen.findByText('No invoices yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New invoice' }));
    expect(await screen.findByRole('heading', { name: 'New invoice' })).toBeInTheDocument();
  });

  it('opens a draft from the list in the editor', async () => {
    await openApp([makeInvoice({ id: 'd1', number: '2026-27/0005', status: 'draft' })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Open 2026-27/0005' }));
    expect(await screen.findByRole('heading', { name: 'Edit draft' })).toBeInTheDocument();
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0005');
  });

  it('opens an issued invoice in the viewer', async () => {
    await openApp([makeInvoice({ id: 'i1', status: 'issued' })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Open 2026-27/0001' }));
    expect(await screen.findByRole('heading', { name: '2026-27/0001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows the viewer after an invoice is issued', async () => {
    await openApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Create your first invoice' }));
    await userEvent.type(await screen.findByLabelText('Client name'), 'Northwind Traders
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 MG Road');
    await userEvent.type(screen.getByLabelText('City'), 'Pune');
    await userEvent.selectOptions(screen.getByLabelText('State'), '27');
    const item = within(screen.getByRole('group', { name: 'Item 1' }));
    await userEvent.type(item.getByLabelText('Description'), 'Consulting');
    await userEvent.clear(item.getByLabelText('Quantity'));
    await userEvent.type(item.getByLabelText('Quantity'), '24');
    await userEvent.type(item.getByLabelText('Rate (₹)'), '3000');
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    expect(await screen.findByRole('button', { name: 'Duplicate as new draft' })).toBeInTheDocument();
    expect(screen.getByText('Issued')).toBeInTheDocument();
  });
});
```
(Import `within` and `makeInvoice` if the file does not already.)

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test`
Expected: FAIL in InvoiceApp, registry and home tests.

- [ ] **Step 3: Implement**

`InvoiceApp.tsx`: replace the `view: 'list' | 'profile'` state with the union above. Replace the placeholder list paragraph with:
```tsx
{view.name === 'list' ? <InvoiceList storage={storage} onNew={() => setView({ name: 'new' })} onEdit={(id) => setView({ name: 'edit', id })} onView={(id) => setView({ name: 'view', id })} renderPdf={renderPdf} /> : null}
{view.name === 'new' || view.name === 'edit' ? (
  <InvoiceEditor key={view.name === 'edit' ? view.id : 'new'} storage={storage} profile={profile} invoiceId={view.name === 'edit' ? view.id : undefined} onBack={() => setView({ name: 'list' })} onIssued={(id) => setView({ name: 'view', id })} renderPdf={renderPdf} />
) : null}
{view.name === 'view' ? <InvoiceViewer storage={storage} invoiceId={view.id} onBack={() => setView({ name: 'list' })} onEdit={(id) => setView({ name: 'edit', id })} renderPdf={renderPdf} /> : null}
```
Navigation buttons: "Invoices" (current when `list` or `view`), "New invoice" (current when `new` or `edit`), "Profile". Add the `renderPdf?: PdfRenderer` prop and pass it down. Keep the profile view, the non-persistent warning and the load-failure handling unchanged. The profile used by the editor is the saved `profile` state (non-null here).

`packages/registry/src/tools.ts`: set the invoice entry's `status: 'available'`. Check the tool page (`apps/web/src/app/tools/[slug]/page.tsx`) and any copy that says "coming soon" for the invoice tool, and fix the home and tool-page tests that depended on it.

- [ ] **Step 4: Run everything**

Run: `pnpm test` then `pnpm typecheck` then `pnpm build`
Expected: all PASS / OK. The service worker precache stamp must still succeed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): wire the editor, list and viewer into the invoice tool and make it available

```

---

### Task 11: End-to-end test in real Chrome

**Files:**
- Create: `apps/web/e2e/invoice.spec.ts`

Follow the existing specs (`onboarding.spec.ts`, `logo.spec.ts`) for the helper that completes onboarding. Add `pdfjs-dist` as a devDependency of `apps/web` if it is not one yet (`pnpm --filter @solokit/web add -D pdfjs-dist`).

- [ ] **Step 1: Write the specs**

1. **Regular seller, full flow:** onboard as a Regular GST seller (valid GSTIN `27AABCT3518Q1ZW`, Maharashtra), open "New invoice", fill the client (Northwind Traders, 4 MG Road, Pune, Maharashtra), one item "Consulting" quantity 24, rate 3000 (18% default), check the totals panel shows `₹84,960.00`, click "Show preview" and wait for the `iframe[title="Invoice preview"]`, click "Issue invoice", expect the viewer heading `2026-27/0001` (or the number for the current financial year as shown in the field before issuing) and the "Issued" badge; click "Download PDF" in the viewer, capture the download, assert the file name starts with `Tax-Invoice-`, read the PDF with pdfjs-dist and assert its text contains `Northwind Traders`, `Consulting`, `84,960.00` and the number. Then go back to the list and assert the invoice appears with `₹84,960.00`. Reload the page and assert it is still there (persistence).
2. **Unregistered seller:** onboard unregistered, new invoice, no GST fields visible (`Place of supply` absent), issue a ₹5,000 invoice, download, PDF text contains `5,000.00` and does not contain `GSTIN`.
3. **Export:** regular seller, tick the export box, currency USD, client in the United States, rate 1234.56, issue; PDF text contains `1,234.56` and `USD` or `$`.
4. **Duplicate and cancel:** issue an invoice, duplicate it from the list (editor opens with the next number), go back, cancel the first invoice with the two-step confirm, and see the `Cancelled` badge.
5. **Mobile:** viewport 390x800, open the editor, assert `document.documentElement.scrollWidth <= window.innerWidth`, take a screenshot into `test-results/`.
6. **Offline after load:** after the first visit has installed the service worker, set the context offline, reload `/tools/invoice/`, create and issue an invoice, download the PDF.

Use the invoice date as shown in the form rather than hard-coding the financial year, since the machine date varies.

- [ ] **Step 2: Run**

Run: `pnpm e2e`
Expected: all specs PASS in real Chrome. Fix real defects in the app, not the tests; report any.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(web): add end-to-end checks of creating, issuing and downloading invoices

```

---

### Task 12: Docs and final verification

- [ ] **Step 1:** Update `README.md` Status (done: invoice editor, preview, issue, download, list; next: themes and backup UI) and the home or privacy copy only if it claims something not yet true (backup export stays a launch gate for Plan 3C-3).
- [ ] **Step 2:** Run `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm e2e`. All must pass.
- [ ] **Step 3:** Commit `docs: update status after the invoice editor` with the trailer.
