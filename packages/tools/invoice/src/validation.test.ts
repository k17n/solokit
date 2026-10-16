import { describe, expect, it } from 'vitest';
import { makeClient, makeInvoice, makeSeller } from './testing';
import { isRealIsoDate, validateClient, validateInvoice } from './validation';

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

  it('flags a fixed discount larger than the line, but not one equal to it', () => {
    const line = (discount: never) => ({ id: 'a', description: 'x', quantity: 2, unit: 'items', rate: 1000, gstRate: 18, discount }) as never;
    const over = makeInvoice({ lines: [line({ kind: 'amount', amount: 2001 } as never)] });
    expect(paths(validateInvoice(over))).toContain('lines[0].discount');
    expect(validateInvoice(makeInvoice({ lines: [line({ kind: 'amount', amount: 2000 } as never)] }))).toEqual([]);
    expect(paths(validateInvoice(makeInvoice({ lines: [line({ kind: 'amount', amount: -1 } as never)] })))).toContain('lines[0].discount');
  });

  it('accepts a valid percent discount and flags one above 100', () => {
    const line = (percent: number) =>
      ({ id: 'a', description: 'x', quantity: 1, unit: 'items', rate: 1000, gstRate: 18, discount: { kind: 'percent', percent } }) as never;
    expect(validateInvoice(makeInvoice({ lines: [line(10)] }))).toEqual([]);
    expect(paths(validateInvoice(makeInvoice({ lines: [line(100.5)] })))).toContain('lines[0].discount');
  });

  it('requires a GST rate on taxed lines only', () => {
    const noRate = [{ id: 'a', description: 'x', quantity: 1, unit: 'items' as const, rate: 1000 }];
    expect(paths(validateInvoice(makeInvoice({ lines: noRate })))).toContain('lines[0].gstRate');
    const unregistered = makeSeller({ gstStatus: 'unregistered', gstin: undefined });
    const composition = makeSeller({ gstStatus: 'composition' });
    expect(validateInvoice(makeInvoice({ seller: unregistered, lines: noRate }))).toEqual([]);
    expect(validateInvoice(makeInvoice({ seller: composition, lines: noRate }))).toEqual([]);
    expect(validateInvoice(makeInvoice({ isExport: true, lines: noRate }))).toEqual([]);
    expect(validateInvoice(makeInvoice({ exemptSupply: true, lines: noRate }))).toEqual([]);
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

describe('validateInvoice: advance and TDS must fit the total', () => {
  // Default invoice: total 8,496,000 paise; 10% TDS on the 7,200,000 taxable value is 720,000.
  const tds = { ratePercent: 10 };
  const zeroLine = [{ id: 'a', description: 'Free', quantity: 1, unit: 'items' as const, rate: 0, gstRate: 18 }];

  it('accepts an advance equal to the total minus TDS', () => {
    expect(validateInvoice(makeInvoice({ tds, advanceReceived: 8496000 - 720000 }))).toEqual([]);
  });

  it('rejects an advance one paisa more than the total minus TDS', () => {
    const issues = validateInvoice(makeInvoice({ tds, advanceReceived: 8496000 - 720000 + 1 }));
    expect(paths(issues)).toEqual(['advanceReceived']);
  });

  it('rejects any advance on a zero-total invoice', () => {
    expect(paths(validateInvoice(makeInvoice({ lines: zeroLine, advanceReceived: 1 })))).toEqual(['advanceReceived']);
    expect(validateInvoice(makeInvoice({ lines: zeroLine, advanceReceived: 0 }))).toEqual([]);
  });

  it('rejects TDS that rounding makes larger than the total', () => {
    // Rs 100.40 rounds down to Rs 100.00, but 100% TDS is taken on the unrounded 100.40.
    const invoice = makeInvoice({
      seller: makeSeller({ gstStatus: 'unregistered', gstin: undefined }),
      placeOfSupplyStateCode: undefined,
      lines: [{ id: 'a', description: 'x', quantity: 1, unit: 'items', rate: 10040 }],
      tds: { ratePercent: 100 },
    });
    const issues = validateInvoice(invoice);
    expect(paths(issues)).toEqual(['advanceReceived']);
    expect(issues[0]?.message).toBe('TDS and the advance together are more than the invoice total');
  });
});

describe('validateInvoice: financial year and currency', () => {
  it('requires the financial year to match the issue date', () => {
    expect(paths(validateInvoice(makeInvoice({ fiscalYear: '2025-26' })))).toEqual(['fiscalYear']);
    expect(validateInvoice(makeInvoice({ issueDate: '2026-03-31', fiscalYear: '2025-26' }))).toEqual([]);
    expect(paths(validateInvoice(makeInvoice({ issueDate: '2026-03-31' })))).toEqual(['fiscalYear']);
  });

  it('does not check the financial year of an invalid date', () => {
    expect(paths(validateInvoice(makeInvoice({ issueDate: '2026-02-30' })))).toEqual(['issueDate']);
  });

  it('issues domestic invoices in INR only', () => {
    const domestic = validateInvoice(makeInvoice({ currency: 'USD' }));
    expect(domestic).toEqual([
      { path: 'currency', message: 'Domestic invoices are issued in rupees (INR). Use another currency only for exports.' },
    ]);
  });

  it('lets exports use any supported currency', () => {
    const seller = makeSeller({ lutNumber: 'AD270326012345Z' });
    for (const currency of ['INR', 'USD', 'EUR', 'GBP'] as const) {
      expect(validateInvoice(makeInvoice({ seller, isExport: true, currency, placeOfSupplyStateCode: undefined, lines: [{ id: 'a', description: 'x', quantity: 1, unit: 'items', rate: 1000 }] }))).toEqual([]);
    }
  });
});

describe('validateInvoice: quantity and line size', () => {
  const withQuantity = (quantity: number, rate = 1000) =>
    makeInvoice({ lines: [{ id: 'a', description: 'x', quantity, unit: 'items', rate, gstRate: 18 }] });

  it('rejects quantities below 0.001 or with more than three decimals', () => {
    const message = 'Quantity can have up to 3 decimals and must be at least 0.001';
    expect(validateInvoice(withQuantity(0.0004))).toEqual([{ path: 'lines[0].quantity', message }]);
    expect(validateInvoice(withQuantity(1.2345))).toEqual([{ path: 'lines[0].quantity', message }]);
  });

  it('accepts 0.001 and 7.5', () => {
    expect(validateInvoice(withQuantity(0.001))).toEqual([]);
    expect(validateInvoice(withQuantity(7.5))).toEqual([]);
  });

  it('rejects a line larger than 1e13 paise', () => {
    expect(validateInvoice(withQuantity(1e12, 10_000_000))).toEqual([{ path: 'lines[0]', message: 'This line is too large' }]);
  });
});


describe('validateInvoice with an enormous total', () => {
  it('reports a problem instead of throwing when many near-limit lines overflow the total', () => {
    const lines = Array.from({ length: 1100 }, (_, index) => ({
      id: `l${index}`,
      description: 'Huge',
      quantity: 1,
      unit: 'fixed' as const,
      rate: 9_000_000_000_000,
      gstRate: 18,
    }));
    const issues = validateInvoice(makeInvoice({ lines }));
    expect(issues.map((issue) => issue.path)).toContain('lines');
  });
});

describe('validateInvoice: quotations', () => {
  const quote = (overrides = {}) => makeInvoice({ kind: 'quote', number: 'QT/2026-27/0001', issueDate: '2026-10-14', validUntil: '2026-11-13', ...overrides });

  it('accepts a quotation with a valid-until date and no due date', () => {
    expect(validateInvoice(quote())).toEqual([]);
    expect(validateInvoice(quote({ validUntil: '2026-10-14' }))).toEqual([]);
  });

  it('requires valid-until, a real date, not before the issue date', () => {
    const { validUntil: _unused, ...without } = quote();
    expect(paths(validateInvoice(without as never))).toEqual(['validUntil']);
    expect(paths(validateInvoice(quote({ validUntil: '2026-02-30' })))).toEqual(['validUntil']);
    expect(validateInvoice(quote({ validUntil: '2026-10-13' }))[0]?.message).toMatch(/before the issue date/);
  });

  it('has no due date', () => {
    expect(paths(validateInvoice(quote({ dueDate: '2026-11-01' })))).toEqual(['dueDate']);
  });

  it('keeps the same line checks', () => {
    expect(paths(validateInvoice(quote({ lines: [] })))).toEqual(['lines']);
  });

  it('does not require valid-until on an invoice', () => {
    expect(validateInvoice(makeInvoice())).toEqual([]);
  });

  it('ignores TDS and advance on a quotation, so they never make it invalid', () => {
    expect(validateInvoice(quote({ advanceReceived: 99999999, tds: { ratePercent: 10 } }))).toEqual([]);
  });
});
