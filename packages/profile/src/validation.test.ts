import { describe, expect, it } from 'vitest';
import { makeProfile as makeSeller } from './testing';
import { validateProfile } from './validation';

const paths = (issues: { path: string }[]) => issues.map((issue) => issue.path);

describe('validateProfile', () => {
  it('accepts a complete regular seller', () => {
    expect(validateProfile(makeSeller())).toEqual([]);
  });

  it('requires a name and the first address line and city', () => {
    const seller = makeSeller({ name: ' ', address: { line1: '', city: '', country: 'India', stateCode: '27' } });
    expect(paths(validateProfile(seller))).toEqual(expect.arrayContaining(['name', 'address.line1', 'address.city']));
  });

  it('requires a valid GSTIN for regular and composition sellers', () => {
    expect(paths(validateProfile(makeSeller({ gstin: undefined })))).toContain('gstin');
    expect(paths(validateProfile(makeSeller({ gstin: '27AAPFU0939F1ZX' })))).toContain('gstin');
    expect(paths(validateProfile(makeSeller({ gstStatus: 'composition', gstin: undefined })))).toContain('gstin');
    expect(validateProfile(makeSeller({ gstStatus: 'composition' }))).toEqual([]);
  });

  it('requires the address state to match the GSTIN state', () => {
    const seller = makeSeller({ address: { line1: 'x', city: 'Bengaluru', stateCode: '29', country: 'India' } });
    expect(paths(validateProfile(seller))).toContain('address.stateCode');
    const missing = makeSeller({ address: { line1: 'x', city: 'Pune', country: 'India' } });
    expect(paths(validateProfile(missing))).toContain('address.stateCode');
  });

  it('flags the state exactly once when it is blank and the GSTIN is invalid', () => {
    const seller = makeSeller({ gstin: '27AAPFU0939F1ZX', address: { line1: 'x', city: 'Pune', country: 'India' } });
    expect(validateProfile(seller).filter((i) => i.path === 'address.stateCode')).toHaveLength(1);
  });

  it('flags a mismatched state exactly once when the GSTIN is valid', () => {
    const seller = makeSeller({ address: { line1: 'x', city: 'Bengaluru', stateCode: '29', country: 'India' } });
    expect(validateProfile(seller).filter((i) => i.path === 'address.stateCode')).toHaveLength(1);
  });

  it('flags a whitespace-only GSTIN on a regular seller', () => {
    expect(paths(validateProfile(makeSeller({ gstin: '   ' })))).toContain('gstin');
  });

  it('does not allow a GSTIN for an unregistered seller', () => {
    const seller = makeSeller({ gstStatus: 'unregistered' });
    expect(paths(validateProfile(seller))).toContain('gstin');
    expect(validateProfile(makeSeller({ gstStatus: 'unregistered', gstin: undefined }))).toEqual([]);
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
    expect(paths(validateProfile(seller))).toEqual(
      expect.arrayContaining(['pan', 'email', 'upiId', 'udyam', 'invoicePrefix', 'bank.accountNumber', 'bank.ifsc']),
    );
  });

  it('accepts a valid UDYAM number and UPI id', () => {
    expect(validateProfile(makeSeller({ udyam: 'UDYAM-MH-19-0012345', upiId: 'asha.rao@okicici' }))).toEqual([]);
  });
});
