import { describe, expect, it } from 'vitest';
import { COMMON_SERVICE_CODES, SAC_AS_OF, searchServiceCodes } from './codes';

describe('service codes', () => {
  it('records when the list was checked', () => {
    expect(SAC_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('has unique six-digit codes with descriptions', () => {
    const codes = COMMON_SERVICE_CODES.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const entry of COMMON_SERVICE_CODES) {
      expect(entry.code).toMatch(/^\d{6}$/);
      expect(entry.description).not.toBe('');
    }
  });

  it('finds codes by number prefix', () => {
    const results = searchServiceCodes('99831');
    expect(results.length).toBeGreaterThan(1);
    expect(results.every((entry) => entry.code.startsWith('99831'))).toBe(true);
  });

  it('finds codes by words in the description, ignoring case', () => {
    const results = searchServiceCodes('IT CONSULTING');
    expect(results.map((entry) => entry.code)).toContain('998313');
  });

  it('requires every word to match', () => {
    expect(searchServiceCodes('consulting zebra')).toEqual([]);
  });

  it('returns nothing for an empty query and respects the limit', () => {
    expect(searchServiceCodes('  ')).toEqual([]);
    expect(searchServiceCodes('services', 2).length).toBeLessThanOrEqual(2);
  });
});
