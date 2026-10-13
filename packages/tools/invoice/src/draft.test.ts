import { describe, expect, it } from 'vitest';
import { InvoiceNotValidError, createDraftInvoice, issueInvoice } from './draft';
import { InvoiceLockedError } from './repositories';
import { makeClient, makeInvoice, makeSeller } from './testing';

const now = new Date('2026-10-14T09:30:00.000Z');
const base = { id: 'inv-9', number: '2026-27/0009', issueDate: '2026-10-14', seller: makeSeller(), client: makeClient(), now };

describe('createDraftInvoice', () => {
  it('builds an empty draft from the seller and client', () => {
    const draft = createDraftInvoice(base);
    expect(draft).toMatchObject({
      id: 'inv-9',
      number: '2026-27/0009',
      status: 'draft',
      kind: 'invoice',
      fiscalYear: '2026-27',
      currency: 'INR',
      isExport: false,
      placeOfSupplyStateCode: '27',
      reverseCharge: false,
      exemptSupply: false,
      lines: [],
      themeId: 'classic',
      createdAt: '2026-10-14T09:30:00.000Z',
      updatedAt: '2026-10-14T09:30:00.000Z',
    });
    expect(draft.seller).toEqual(base.seller);
    expect(draft.client).toEqual(base.client);
  });

  it('copies snapshots rather than sharing them', () => {
    const draft = createDraftInvoice(base);
    expect(draft.seller).not.toBe(base.seller);
    expect(draft.client).not.toBe(base.client);
    expect(draft.seller.address).not.toBe(base.seller.address);
  });

  it('copies default notes and terms and honours the default theme', () => {
    const draft = createDraftInvoice({ ...base, seller: makeSeller({ defaultNotes: 'Thanks', defaultTerms: 'Net 15' }), defaultThemeId: 'modern' });
    expect(draft.notes).toBe('Thanks');
    expect(draft.terms).toBe('Net 15');
    expect(draft.themeId).toBe('modern');
    const plain = createDraftInvoice(base);
    expect('notes' in plain).toBe(false);
    expect('terms' in plain).toBe(false);
  });

  it('omits the place of supply when the client has no state', () => {
    const client = makeClient({ address: { line1: 'x', city: 'Y', country: 'India' } });
    expect('placeOfSupplyStateCode' in createDraftInvoice({ ...base, client })).toBe(false);
  });

  it('uses the current time by default', () => {
    const { now: _ignored, ...rest } = base;
    expect(Number.isNaN(Date.parse(createDraftInvoice(rest).createdAt))).toBe(false);
  });
});

describe('issueInvoice', () => {
  const line = { id: 'l1', description: 'Consulting', quantity: 2, unit: 'hours' as const, rate: 100000, gstRate: 18 };

  it('refuses a draft with no lines', () => {
    const draft = createDraftInvoice(base);
    try {
      issueInvoice(draft);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvoiceNotValidError);
      expect((error as InvoiceNotValidError).issues.map((issue) => issue.path)).toContain('lines');
    }
  });

  it('issues a valid draft without changing the original', () => {
    const draft = { ...createDraftInvoice(base), lines: [line] };
    const issued = issueInvoice(draft);
    expect(issued.status).toBe('issued');
    expect(draft.status).toBe('draft');
    expect(issued).not.toBe(draft);
  });

  it('only issues drafts', () => {
    expect(() => issueInvoice(makeInvoice())).toThrow(InvoiceLockedError);
    expect(() => issueInvoice(makeInvoice({ status: 'cancelled' }))).toThrow(InvoiceLockedError);
  });
});

describe('issueInvoice copies its input', () => {
  it('does not share nested objects with the draft it was given', () => {
    const draft = makeInvoice({ status: 'draft' });
    const issued = issueInvoice(draft);
    expect(issued.status).toBe('issued');
    expect(issued.lines).not.toBe(draft.lines);
    expect(issued.seller).not.toBe(draft.seller);
    expect(issued.client).not.toBe(draft.client);
    expect(draft.status).toBe('draft');
  });
});
