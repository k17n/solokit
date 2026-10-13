import { describe, expect, it } from 'vitest';
import { gstinChecksumChar, validateGstin } from './gstin';

describe('gstinChecksumChar', () => {
  it('computes the check character', () => {
    expect(gstinChecksumChar('27AAPFU0939F1Z')).toBe('V');
    expect(gstinChecksumChar('29AAGCB7383J1Z')).toBe('4');
  });
});

describe('validateGstin', () => {
  it('accepts valid GSTINs and returns the state and PAN', () => {
    expect(validateGstin('27AAPFU0939F1ZV')).toEqual({
      valid: true,
      stateCode: '27',
      pan: 'AAPFU0939F',
    });
    expect(validateGstin('29AAGCB7383J1Z4')).toEqual({
      valid: true,
      stateCode: '29',
      pan: 'AAGCB7383J',
    });
  });

  it('normalises case and surrounding spaces', () => {
    expect(validateGstin('  27aapfu0939f1zv ').valid).toBe(true);
  });

  it('rejects the wrong shape', () => {
    const result = validateGstin('27AAPFU0939F1Z');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/15 characters/);
  });

  it('rejects an unknown state code', () => {
    const result = validateGstin('00AAPFU0939F1ZV');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/state code/i);
  });

  it('rejects a wrong check character', () => {
    const result = validateGstin('27AAPFU0939F1ZX');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/check character/i);
  });

  it('rejects a missing Z in position 14', () => {
    expect(validateGstin('27AAPFU0939F1AV').valid).toBe(false);
  });
});
