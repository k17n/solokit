import { describe, expect, it } from 'vitest';
import { addDays, addMonths, addYears, formatDate, isRealIsoDate } from './dates';

describe('dates', () => {
  it('checks real dates', () => {
    expect(isRealIsoDate('2028-02-29')).toBe(true);
    expect(isRealIsoDate('2027-02-29')).toBe(false);
    expect(isRealIsoDate('2026-13-01')).toBe(false);
    expect(isRealIsoDate('16/10/2026')).toBe(false);
  });
  it('formats and leaves non-dates alone', () => {
    expect(formatDate('2026-10-16')).toBe('16 October 2026');
    expect(formatDate('soon')).toBe('soon');
  });
  it('adds months, clamping to the end of a shorter month', () => {
    expect(addMonths('2026-10-16', 24)).toBe('2028-10-16');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2027-12-31', 2)).toBe('2028-02-29');
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});
