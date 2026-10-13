import { describe, expect, it } from 'vitest';
import { INDIAN_STATES, getStateByCode, isValidStateCode } from './states';

describe('Indian GST state codes', () => {
  it('maps well-known codes', () => {
    expect(getStateByCode('27')?.name).toBe('Maharashtra');
    expect(getStateByCode('29')?.name).toBe('Karnataka');
    expect(getStateByCode('07')?.name).toBe('Delhi');
    expect(getStateByCode('33')?.name).toBe('Tamil Nadu');
    expect(getStateByCode('36')?.name).toBe('Telangana');
  });

  it('accepts the special codes', () => {
    expect(isValidStateCode('97')).toBe(true);
    expect(isValidStateCode('99')).toBe(true);
  });

  it('rejects unknown codes', () => {
    expect(isValidStateCode('00')).toBe(false);
    expect(isValidStateCode('39')).toBe(false);
    expect(isValidStateCode('7')).toBe(false);
    expect(getStateByCode('00')).toBeUndefined();
  });

  it('has unique codes', () => {
    const codes = INDIAN_STATES.map((state) => state.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.length).toBeGreaterThanOrEqual(38);
  });
});
