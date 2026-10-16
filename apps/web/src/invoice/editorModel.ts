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

/** The financial year of an ISO date, or null when the date is not a real one (yet). */
export function fiscalYearOf(isoDate: string): string | null {
  return isRealIsoDate(isoDate) ? indianFiscalYear(isoDate) : null;
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
  if (state.isExport && state.client.country.trim().toLowerCase() === 'india') {
    add([{ path: 'address.country', message: "Enter the client's country outside India" }], 'client.');
  }
  add(validateClientForm(clientFormFor(state)), 'client.');
  add(validateInvoice(invoice));
  const numberYear = /^(\d{4}-\d{2})\//.exec(invoice.number)?.[1];
  const dateYear = fiscalYearOf(state.issueDate);
  if (numberYear && dateYear && numberYear !== dateYear) {
    add([{ path: 'number', message: `This number belongs to financial year ${numberYear} but the date is in ${dateYear}` }]);
  }
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
