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
