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
});
