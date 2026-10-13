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
