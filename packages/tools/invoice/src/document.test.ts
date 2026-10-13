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
    expect(doc.totals.slice(1, 3).map((row) => row.emphasis)).toEqual(['muted', 'muted']);
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
    expect(doc.totals.at(-2)?.emphasis).toBe('muted');
    expect(doc.payment.upi?.payload).toContain('am=77760.00');
    expect(doc.declarations).toEqual([
      'TDS at 10% is expected to be deducted by the client. Net payable is shown after this deduction.',
    ]);
  });

  it('shows an advance', () => {
    const doc = buildInvoiceDocument(makeInvoice({ advanceReceived: 3000000 }));
    expect(labels(doc).slice(-3)).toEqual(['Total', 'Advance received', 'Net payable']);
    expect(amounts(doc).slice(-2)).toEqual(['-₹30,000.00', '₹54,960.00']);
    expect(doc.totals.slice(-2).map((row) => row.emphasis)).toEqual(['muted', 'net']);
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

describe('buildInvoiceDocument: tax rows in depth', () => {
  const line = (id: string, rate: number, gstRate: number, extra = {}) => ({
    id,
    description: id,
    quantity: 1,
    unit: 'items' as const,
    rate,
    gstRate,
    ...extra,
  });

  it('groups lines at the same rate and lists the higher rate first', () => {
    const doc = buildInvoiceDocument(
      makeInvoice({ lines: [line('a', 1000000, 5), line('b', 1000000, 18), line('c', 500000, 18)] }),
    );
    expect(labels(doc)).toEqual(['Taxable value', 'CGST @9%', 'SGST @9%', 'CGST @2.5%', 'SGST @2.5%', 'Total']);
    expect(amounts(doc)).toEqual(['₹25,000.00', '₹1,350.00', '₹1,350.00', '₹250.00', '₹250.00', '₹28,200.00']);
  });

  it('mutes every tax row under reverse charge', () => {
    const doc = buildInvoiceDocument(
      makeInvoice({ reverseCharge: true, lines: [line('a', 1000000, 5), line('b', 1000000, 18)] }),
    );
    const taxRows = doc.totals.filter((row) => /^(CGST|SGST|IGST)/.test(row.label));
    expect(taxRows).toHaveLength(4);
    for (const row of taxRows) {
      expect(row.emphasis).toBe('muted');
      expect(row.label.endsWith(' (reverse charge)')).toBe(true);
    }
  });

  it('combines reverse charge with TDS', () => {
    const doc = buildInvoiceDocument(makeInvoice({ reverseCharge: true, tds: { ratePercent: 10 } }));
    expect(labels(doc)).toEqual([
      'Taxable value',
      'CGST @9% (reverse charge)',
      'SGST @9% (reverse charge)',
      'Total',
      'TDS @10% (deducted by client)',
      'Net payable',
    ]);
    expect(amounts(doc)).toEqual(['₹72,000.00', '₹6,480.00', '₹6,480.00', '₹72,000.00', '-₹7,200.00', '₹64,800.00']);
    expect(doc.totals.slice(-3).map((row) => row.emphasis)).toEqual(['total', 'muted', 'net']);
  });

  it('labels a 0.25% special rate as 0.125% each and keeps the line rate', () => {
    const doc = buildInvoiceDocument(makeInvoice({ lines: [line('Diamonds', 1000000, 0.25)] }));
    expect(labels(doc)).toEqual(['Taxable value', 'CGST @0.125%', 'SGST @0.125%', 'Total']);
    expect(amounts(doc)).toEqual(['₹10,000.00', '₹12.50', '₹12.50', '₹10,025.00']);
    expect(doc.lines[0]?.taxRate).toBe('0.25%');
  });

  it('adds no @0% rows for a zero-rated line on a taxed invoice', () => {
    const doc = buildInvoiceDocument(makeInvoice({ lines: [line('a', 100000, 0), line('b', 1000000, 18)] }));
    expect(labels(doc).some((label) => label.includes('@0%'))).toBe(false);
    expect(labels(doc)).toEqual(['Taxable value', 'CGST @9%', 'SGST @9%', 'Total']);
    expect(amounts(doc)).toEqual(['₹11,000.00', '₹900.00', '₹900.00', '₹12,800.00']);
    expect(doc.lines[0]?.taxRate).toBe('0%');
  });
});

describe('buildInvoiceDocument: documents without tax', () => {
  const discounted = [
    {
      id: 'a',
      description: 'Retainer',
      quantity: 1,
      unit: 'retainer' as const,
      rate: 1000000,
      discount: { kind: 'percent' as const, percent: 10 },
    },
  ];
  const unregistered = { seller: makeSeller({ gstStatus: 'unregistered' as const, gstin: undefined }) };

  it.each([
    ['unregistered', unregistered],
    ['composition', { seller: makeSeller({ gstStatus: 'composition' }) }],
  ])('labels the post-discount row "Net amount" for a %s seller', (_name, overrides) => {
    const doc = buildInvoiceDocument(makeInvoice({ ...overrides, lines: discounted }));
    expect(doc.showTax).toBe(false);
    expect(labels(doc)).toEqual(['Subtotal', 'Discount', 'Net amount', 'Total']);
    expect(amounts(doc)).toEqual(['₹10,000.00', '-₹1,000.00', '₹9,000.00', '₹9,000.00']);
  });

  it('shows the round-off without a tax block', () => {
    const doc = buildInvoiceDocument(
      makeInvoice({
        ...unregistered,
        lines: [{ id: 'a', description: 'Item', quantity: 1, unit: 'items', rate: 33333 }],
      }),
    );
    expect(labels(doc)).toEqual(['Subtotal', 'Round off', 'Total']);
    expect(amounts(doc)).toEqual(['₹333.33', '-₹0.33', '₹333.00']);
  });
});

describe('buildInvoiceDocument: currency and payment edge cases', () => {
  const item = (rate: number, gstRate?: number) => ({
    id: 'a',
    description: 'Item',
    quantity: 1,
    unit: 'items' as const,
    rate,
    ...(gstRate !== undefined ? { gstRate } : {}),
  });

  it('omits UPI for a domestic invoice in USD', () => {
    const doc = buildInvoiceDocument(makeInvoice({ currency: 'USD', lines: [item(100000, 18)] }));
    expect(doc.payment.upi).toBeUndefined();
  });

  it('writes EUR and GBP amounts in words', () => {
    const eur = buildInvoiceDocument(makeInvoice({ currency: 'EUR', isExport: true, seller: makeSeller({ lutNumber: 'AD270326012345Z' }), lines: [item(100000)] }));
    const gbp = buildInvoiceDocument(makeInvoice({ currency: 'GBP', isExport: true, seller: makeSeller({ lutNumber: 'AD270326012345Z' }), lines: [item(100000)] }));
    expect(eur.amountInWords).toBe('One Thousand Euros Only');
    expect(gbp.amountInWords).toBe('One Thousand Pounds Only');
  });

  it('handles a zero grand total', () => {
    const doc = buildInvoiceDocument(makeInvoice({ lines: [item(0, 18)] }));
    expect(doc.amountInWords).toBe('Zero Rupees Only');
    expect(doc.totals.at(-1)?.amount).toBe('₹0.00');
    expect(doc.payment.upi).toBeUndefined();
  });

  it('shows a nil net payable when an advance covers the total', () => {
    const doc = buildInvoiceDocument(makeInvoice({ advanceReceived: 8496000 }));
    expect(doc.totals.at(-1)).toMatchObject({ label: 'Net payable', amount: '₹0.00', emphasis: 'net' });
    expect(doc.payment.upi).toBeUndefined();
  });
});

describe('buildInvoiceDocument: rounding default', () => {
  const usdLine = { id: 'a', description: 'Design', quantity: 1, unit: 'items' as const, rate: 123456 };
  const unregistered = makeSeller({ gstStatus: 'unregistered', gstin: undefined });

  it('does not round a foreign-currency invoice from an unregistered seller', () => {
    const doc = buildInvoiceDocument(
      makeInvoice({ seller: unregistered, currency: 'USD', isExport: true, placeOfSupplyStateCode: undefined, lines: [usdLine] }),
    );
    expect(doc.totals.at(-1)?.amount).toBe('$1,234.56');
    expect(labels(doc)).not.toContain('Round off');
  });

  it('still rounds a domestic INR invoice from an unregistered seller', () => {
    const doc = buildInvoiceDocument(makeInvoice({ seller: unregistered, placeOfSupplyStateCode: undefined, lines: [usdLine] }));
    expect(doc.totals.at(-1)?.amount).toBe('₹1,235.00');
    expect(labels(doc)).toContain('Round off');
  });

  it('lets an explicit roundOff win', () => {
    const doc = buildInvoiceDocument(
      makeInvoice({ seller: unregistered, currency: 'USD', isExport: true, roundOff: true, placeOfSupplyStateCode: undefined, lines: [usdLine] }),
    );
    expect(doc.totals.at(-1)?.amount).toBe('$1,235.00');
  });
});

describe('buildInvoiceDocument: TDS wording', () => {
  it('formats the TDS row label like the declaration', () => {
    const doc = buildInvoiceDocument(makeInvoice({ tds: { ratePercent: 10.004 } }));
    expect(labels(doc)).toContain('TDS @10% (deducted by client)');
    expect(doc.declarations.join(' ')).toContain('TDS at 10%');
  });

  it('shows no TDS wording when the rate rounds to no tax', () => {
    const doc = buildInvoiceDocument(makeInvoice({ tds: { ratePercent: 0.00001 } }));
    expect(doc.declarations.join(' ')).not.toContain('TDS');
    expect(labels(doc).some((label) => label.startsWith('TDS'))).toBe(false);
    expect(labels(doc)).not.toContain('Net payable');
  });
});

describe('buildInvoiceDocument: status, kind and signatory', () => {
  it('copies status and kind and names the signatory', () => {
    const doc = buildInvoiceDocument(makeInvoice({ status: 'cancelled', kind: 'proforma' }));
    expect(doc.status).toBe('cancelled');
    expect(doc.kind).toBe('proforma');
    expect(doc.signatory).toEqual({ forName: 'Asha Rao Consulting', label: 'Authorised signatory' });
  });
});

describe('buildInvoiceDocument: odd seller data that validation lets through', () => {
  it('ignores a whitespace-only UPI id instead of throwing', () => {
    const doc = buildInvoiceDocument(makeInvoice({ seller: makeSeller({ upiId: '   ' }) }));
    expect(doc.payment.upi).toBeUndefined();
  });

  it('trims a UPI id with stray spaces', () => {
    const doc = buildInvoiceDocument(makeInvoice({ seller: makeSeller({ upiId: ' asha@okhdfc ' }) }));
    expect(doc.payment.upi?.id).toBe('asha@okhdfc');
  });
});
