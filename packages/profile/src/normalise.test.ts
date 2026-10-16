import { describe, expect, it } from 'vitest';
import { normaliseProfile } from './normalise';
import { makeProfile as makeSeller } from './testing';
import { validateProfile } from './validation';

describe('normaliseProfile', () => {
  it('trims strings, upper-cases identifiers and lower-cases email', () => {
    const seller = makeSeller({
      name: '  Asha Rao  ',
      gstin: ' 27aapfu0939f1zv ',
      pan: ' aapfu0939f',
      udyam: ' udyam-mh-19-0012345 ',
      email: ' Asha@Example.COM ',
      address: { line1: ' 12 Road ', line2: ' Near park ', city: ' Mumbai ', postalCode: ' 400050 ', stateCode: ' 27 ', country: ' India ' },
      bank: { accountName: ' Asha ', accountNumber: ' 123456789012 ', ifsc: ' hdfc0001234 ', bankName: ' HDFC ', branch: ' Bandra ' },
    });
    const result = normaliseProfile(seller);
    expect(result).toMatchObject({
      name: 'Asha Rao',
      gstin: '27AAPFU0939F1ZV',
      pan: 'AAPFU0939F',
      udyam: 'UDYAM-MH-19-0012345',
      email: 'asha@example.com',
      address: { line1: '12 Road', line2: 'Near park', city: 'Mumbai', postalCode: '400050', stateCode: '27', country: 'India' },
      bank: { accountName: 'Asha', accountNumber: '123456789012', ifsc: 'HDFC0001234', bankName: 'HDFC', branch: 'Bandra' },
    });
  });

  it('removes optional fields that become empty', () => {
    const result = normaliseProfile(
      makeSeller({ pan: '  ', email: '', upiId: ' ', address: { line1: 'x', line2: ' ', city: 'Pune', postalCode: '', country: 'India', stateCode: '27' } }),
    );
    expect('pan' in result).toBe(false);
    expect('email' in result).toBe(false);
    expect('upiId' in result).toBe(false);
    expect('line2' in result.address).toBe(false);
    expect('postalCode' in result.address).toBe(false);
  });

  it('does not mutate its input', () => {
    const seller = makeSeller({ gstin: ' 27aapfu0939f1zv ' });
    const copy = structuredClone(seller);
    normaliseProfile(seller);
    expect(seller).toEqual(copy);
  });

  it('makes a lower-case GSTIN pass validation', () => {
    const seller = makeSeller({ gstin: '27aapfu0939f1zv', pan: 'aapfu0939f' });
    expect(validateProfile(seller).length).toBeGreaterThan(0);
    expect(validateProfile(normaliseProfile(seller))).toEqual([]);
  });
});
