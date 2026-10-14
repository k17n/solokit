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
