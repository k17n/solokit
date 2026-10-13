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
    const legacy = calculateGst(intra({ lines: [{ quantity: 1, unitRate: 1_000_000, gstRate: 12 }] }));
    expect(legacy.lines[0]).toMatchObject({ gstRate: 12, cgst: 60_000, sgst: 60_000, total: 1_120_000 });
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

describe('calculateGst: export round-off default', () => {
  const exportInput = (overrides: Partial<GstInput> = {}): GstInput => ({
    sellerStatus: 'regular',
    sellerStateCode: '27',
    isExport: true,
    lines: [{ quantity: 1, unitRate: 123_456, gstRate: 18 }],
    ...overrides,
  });

  it('does not round off an export by default', () => {
    const result = calculateGst(exportInput());
    expect(result.totals).toMatchObject({ roundOff: 0, grandTotal: 123_456 });
  });

  it('rounds an export when explicitly asked', () => {
    const result = calculateGst(exportInput({ roundOff: true }));
    expect(result.totals).toMatchObject({ roundOff: 44, grandTotal: 123_500 });
  });

  it('still rounds domestic supplies by default', () => {
    const result = calculateGst(intra({ lines: [{ quantity: 1, unitRate: 33_333, gstRate: 18 }] }));
    expect(result.totals).toMatchObject({ roundOff: -33, grandTotal: 39_300 });
  });
});

describe('calculateGst: net payable is never negative', () => {
  it('accepts an advance equal to grand total minus TDS', () => {
    const result = calculateGst(intra({ tds: { ratePercent: 10 }, advanceReceived: 1_080_000 }));
    expect(result.netPayable).toBe(0);
  });

  it('rejects one paisa more', () => {
    expect(() => calculateGst(intra({ tds: { ratePercent: 10 }, advanceReceived: 1_080_001 }))).toThrow(GstInputError);
  });

  it('rejects an advance equal to the full total when TDS applies', () => {
    expect(() => calculateGst(intra({ tds: { ratePercent: 10 }, advanceReceived: 1_180_000 }))).toThrow(GstInputError);
  });

  it('checks the advance against the reduced total under reverse charge', () => {
    const input = (advanceReceived: number) => intra({ reverseCharge: true, tds: { ratePercent: 10 }, advanceReceived });
    expect(calculateGst(input(900_000)).netPayable).toBe(0);
    expect(() => calculateGst(input(900_001))).toThrow(GstInputError);
    expect(() => calculateGst(intra({ reverseCharge: true, advanceReceived: 1_000_001 }))).toThrow(GstInputError);
  });
});

describe('calculateGst: non-finite and negative inputs', () => {
  it('rejects a non-finite discount percent', () => {
    const percent = (p: number) =>
      intra({ lines: [{ quantity: 1, unitRate: 1000, gstRate: 18, discount: { kind: 'percent', percent: p } }] });
    expect(() => calculateGst(percent(NaN))).toThrow(GstInputError);
    expect(() => calculateGst(percent(Infinity))).toThrow(GstInputError);
  });

  it('rejects a non-finite TDS rate', () => {
    expect(() => calculateGst(intra({ tds: { ratePercent: NaN } }))).toThrow(GstInputError);
    expect(() => calculateGst(intra({ tds: { ratePercent: Infinity } }))).toThrow(GstInputError);
  });

  it('rejects a negative unit rate', () => {
    expect(() => calculateGst(intra({ lines: [{ quantity: 1, unitRate: -100, gstRate: 18 }] }))).toThrow(GstInputError);
  });
});

describe('calculateGst: additional coverage', () => {
  it('combines reverse charge with round-off on the taxable value only', () => {
    const result = calculateGst(intra({ reverseCharge: true, lines: [{ quantity: 1, unitRate: 33_333, gstRate: 18 }] }));
    expect(result.totals).toMatchObject({
      taxable: 33_333,
      cgst: 3_000,
      sgst: 3_000,
      totalTax: 6_000,
      roundOff: -33,
      grandTotal: 33_300,
    });
    expect(result.netPayable).toBe(33_300);
  });

  it('computes special rates exactly', () => {
    const at = (gstRate: number) => calculateGst(intra({ lines: [{ quantity: 1, unitRate: 1_000_000, gstRate }] }));
    expect(at(0.25).lines[0]).toMatchObject({ cgst: 1_250, sgst: 1_250, total: 1_002_500 });
    expect(at(3).lines[0]).toMatchObject({ cgst: 15_000, sgst: 15_000, total: 1_030_000 });
  });

  it('sums per-line rounded values across a multi-line invoice', () => {
    const result = calculateGst(
      intra({
        roundOff: false,
        lines: [
          { quantity: 1, unitRate: 1010, gstRate: 5 }, // cgst 25.25 -> 25
          { quantity: 1, unitRate: 3333, gstRate: 18 }, // cgst 299.97 -> 300
          { quantity: 3, unitRate: 999, gstRate: 12 }, // taxable 2997, cgst 179.82 -> 180
        ],
      }),
    );
    expect(result.lines.map((l) => l.cgst)).toEqual([25, 300, 180]);
    expect(result.totals).toMatchObject({ taxable: 7_340, cgst: 505, sgst: 505, totalTax: 1_010, grandTotal: 8_350 });
    expect(result.totals.grandTotal).toBe(result.lines.reduce((s, l) => s + l.total, 0));
  });
});
