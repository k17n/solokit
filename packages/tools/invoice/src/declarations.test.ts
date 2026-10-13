import { describe, expect, it } from 'vitest';
import { buildDeclarations } from './declarations';
import { makeSeller } from './testing';

const base = { seller: makeSeller(), mode: 'intra-state' as const, exemptSupply: false, reverseCharge: false, isProforma: false };

describe('buildDeclarations', () => {
  it('has nothing to say for an ordinary tax invoice', () => {
    expect(buildDeclarations(base)).toEqual([]);
  });

  it('prints the mandatory composition declaration', () => {
    expect(buildDeclarations({ ...base, seller: makeSeller({ gstStatus: 'composition' }), mode: 'no-tax' })).toEqual([
      'Composition taxable person, not eligible to collect tax on supplies.',
    ]);
  });

  it('explains exempt supplies', () => {
    expect(buildDeclarations({ ...base, mode: 'no-tax', exemptSupply: true })).toEqual([
      'Exempt supply: no tax is charged on this bill of supply.',
    ]);
  });

  it('notes that an unregistered seller is not registered, unless switched off', () => {
    const unregistered = makeSeller({ gstStatus: 'unregistered', gstin: undefined });
    expect(buildDeclarations({ ...base, seller: unregistered, mode: 'no-tax' })).toEqual(['Not registered under GST.']);
    const quiet = makeSeller({ gstStatus: 'unregistered', gstin: undefined, unregisteredNote: false });
    expect(buildDeclarations({ ...base, seller: quiet, mode: 'no-tax' })).toEqual([]);
  });

  it('states the LUT for exports, with the number when known', () => {
    expect(buildDeclarations({ ...base, mode: 'export-lut' })).toEqual([
      'Supply meant for export under Letter of Undertaking (LUT) without payment of integrated tax.',
    ]);
    const withLut = makeSeller({ lutNumber: 'AD270326012345Z' });
    expect(buildDeclarations({ ...base, seller: withLut, mode: 'export-lut' })).toEqual([
      'Supply meant for export under Letter of Undertaking (LUT No. AD270326012345Z) without payment of integrated tax.',
    ]);
  });

  it('flags reverse charge', () => {
    expect(buildDeclarations({ ...base, reverseCharge: true })).toEqual([
      'Tax on this supply is payable on reverse charge basis by the recipient.',
    ]);
  });

  it('mentions TDS when it applies', () => {
    expect(buildDeclarations({ ...base, tdsRatePercent: 10 })).toEqual([
      'TDS at 10% is expected to be deducted by the client. Net payable is shown after this deduction.',
    ]);
    expect(buildDeclarations({ ...base, tdsRatePercent: 0 })).toEqual([]);
  });

  it('marks a proforma and keeps a stable order', () => {
    const lines = buildDeclarations({
      ...base,
      isProforma: true,
      reverseCharge: true,
      tdsRatePercent: 2.5,
    });
    expect(lines).toEqual([
      'This is a proforma invoice. It is not a tax invoice.',
      'Tax on this supply is payable on reverse charge basis by the recipient.',
      'TDS at 2.5% is expected to be deducted by the client. Net payable is shown after this deduction.',
    ]);
  });
  it('ignores reverse charge when the supply is not taxed', () => {
    expect(buildDeclarations({ ...base, mode: 'no-tax', reverseCharge: true })).toEqual([]);
    expect(buildDeclarations({ ...base, mode: 'export-lut', reverseCharge: true })).toEqual([
      'Supply meant for export under Letter of Undertaking (LUT) without payment of integrated tax.',
    ]);
  });

  it('only prints the exempt line for a regular seller on a no-tax supply', () => {
    expect(buildDeclarations({ ...base, mode: 'intra-state', exemptSupply: true })).toEqual([]);
    const unregistered = makeSeller({ gstStatus: 'unregistered', gstin: undefined });
    expect(buildDeclarations({ ...base, seller: unregistered, mode: 'no-tax', exemptSupply: true })).toEqual([
      'Not registered under GST.',
    ]);
  });

  it('does not print the export line for a composition seller', () => {
    expect(buildDeclarations({ ...base, seller: makeSeller({ gstStatus: 'composition' }), mode: 'export-lut' })).toEqual([
      'Composition taxable person, not eligible to collect tax on supplies.',
    ]);
  });

  it('orders proforma, composition and TDS', () => {
    expect(
      buildDeclarations({
        ...base,
        seller: makeSeller({ gstStatus: 'composition' }),
        mode: 'no-tax',
        isProforma: true,
        tdsRatePercent: 10,
      }),
    ).toEqual([
      'This is a proforma invoice. It is not a tax invoice.',
      'Composition taxable person, not eligible to collect tax on supplies.',
      'TDS at 10% is expected to be deducted by the client. Net payable is shown after this deduction.',
    ]);
  });

  it('formats the TDS rate cleanly and ignores invalid rates', () => {
    expect(buildDeclarations({ ...base, tdsRatePercent: 0.1 + 0.2 })).toEqual([
      'TDS at 0.3% is expected to be deducted by the client. Net payable is shown after this deduction.',
    ]);
    expect(buildDeclarations({ ...base, tdsRatePercent: -5 })).toEqual([]);
    expect(buildDeclarations({ ...base, tdsRatePercent: Number.NaN })).toEqual([]);
  });
});
