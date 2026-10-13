import { describe, expect, it } from 'vitest';
import { formatIsoDate } from './format';

describe('formatIsoDate', () => {
  it('formats an ISO date as day, short month, year', () => {
    expect(formatIsoDate('2026-10-13')).toBe('13 Oct 2026');
    expect(formatIsoDate('2025-09-22')).toBe('22 Sep 2025');
    expect(formatIsoDate('2026-01-05')).toBe('5 Jan 2026');
  });

  it('rejects anything that is not an ISO date', () => {
    expect(() => formatIsoDate('13/10/2026')).toThrow(RangeError);
    expect(() => formatIsoDate('2026-13-01')).toThrow(RangeError);
  });
});
