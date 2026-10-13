import { describe, expect, it } from 'vitest';
import {
  CURRENT_GST_SLABS,
  GST_SLAB_REFORM_DATE,
  IN_RULES_AS_OF,
  REGISTRATION_THRESHOLDS,
  isAllowedGstRate,
  isLegacyRateForDate,
} from './rules';

describe('India GST rules data', () => {
  it('records when the rules were last verified', () => {
    expect(IN_RULES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('offers the post-reform slabs', () => {
    expect([...CURRENT_GST_SLABS]).toEqual([0, 5, 18, 40]);
    expect(GST_SLAB_REFORM_DATE).toBe('2025-09-22');
  });

  it('allows current, special and legacy rates but nothing else', () => {
    for (const rate of [0, 0.25, 3, 5, 12, 18, 28, 40]) {
      expect(isAllowedGstRate(rate)).toBe(true);
    }
    for (const rate of [7, -5, 100, 17.5]) {
      expect(isAllowedGstRate(rate)).toBe(false);
    }
  });

  it('flags legacy rates only on or after the reform date', () => {
    expect(isLegacyRateForDate(12, '2025-09-22')).toBe(true);
    expect(isLegacyRateForDate(28, '2026-01-01')).toBe(true);
    expect(isLegacyRateForDate(12, '2025-09-21')).toBe(false);
    expect(isLegacyRateForDate(18, '2026-01-01')).toBe(false);
  });

  it('stores registration thresholds in paise', () => {
    expect(REGISTRATION_THRESHOLDS.services).toBe(2_000_000_00); // Rs 20 lakh
    expect(REGISTRATION_THRESHOLDS.goods).toBe(4_000_000_00); // Rs 40 lakh
    expect(REGISTRATION_THRESHOLDS.servicesSpecialCategory).toBe(1_000_000_00); // Rs 10 lakh
  });
});
