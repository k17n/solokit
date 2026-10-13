import { describe, expect, it } from 'vitest';
import {
  MoneyError,
  assertMinor,
  formatMoney,
  lineAmount,
  parseMoney,
  percentOf,
  roundToWhole,
  sum,
} from './money';

describe('assertMinor', () => {
  it('accepts safe integers', () => {
    expect(() => assertMinor(12345)).not.toThrow();
    expect(() => assertMinor(-5)).not.toThrow();
  });

  it('rejects fractions, NaN and unsafe integers', () => {
    expect(() => assertMinor(1.5)).toThrow(MoneyError);
    expect(() => assertMinor(Number.NaN)).toThrow(MoneyError);
    expect(() => assertMinor(2 ** 60)).toThrow(MoneyError);
  });
});

describe('parseMoney', () => {
  it('parses whole and decimal amounts into minor units', () => {
    expect(parseMoney('12')).toBe(1200);
    expect(parseMoney('1234.5')).toBe(123450);
    expect(parseMoney('1234.56')).toBe(123456);
    expect(parseMoney('0.05')).toBe(5);
  });

  it('ignores thousands separators and surrounding spaces', () => {
    expect(parseMoney('1,23,456.78')).toBe(12345678);
    expect(parseMoney(' 12 ')).toBe(1200);
  });

  it('handles negatives and negative zero', () => {
    expect(parseMoney('-5.25')).toBe(-525);
    expect(parseMoney('-0')).toBe(0);
  });

  it('returns null for invalid input', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1.234')).toBeNull();
    expect(parseMoney('.5')).toBeNull();
    expect(parseMoney('5.')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats INR with Indian digit grouping by default', () => {
    expect(formatMoney(12345600)).toBe('₹1,23,456.00');
  });

  it('formats other currencies with a given locale', () => {
    expect(formatMoney(123456, 'USD', 'en-US')).toBe('$1,234.56');
  });
});

describe('percentOf', () => {
  it('computes whole percentages', () => {
    expect(percentOf(10000, 18)).toBe(1800);
  });

  it('rounds half away from zero', () => {
    expect(percentOf(1010, 5)).toBe(51); // 50.5
    expect(percentOf(1010, 2.5)).toBe(25); // 25.25
    expect(percentOf(1, 50)).toBe(1); // 0.5
    expect(percentOf(-1, 50)).toBe(-1); // -0.5
  });

  it('supports up to four decimals in the rate', () => {
    expect(percentOf(1999, 0.125)).toBe(2); // 2.49875
  });

  it('stays exact for very large amounts', () => {
    expect(percentOf(100_000_000_000, 40)).toBe(40_000_000_000);
  });
});

describe('lineAmount', () => {
  it('multiplies fractional quantities exactly', () => {
    expect(lineAmount(7.5, 300000)).toBe(2250000);
    expect(lineAmount(1, 12345)).toBe(12345);
  });

  it('rounds to the nearest paisa', () => {
    expect(lineAmount(1.333, 100)).toBe(133); // 133.3
  });

  it('rejects negative or non-finite quantities', () => {
    expect(() => lineAmount(-1, 100)).toThrow(MoneyError);
    expect(() => lineAmount(Number.NaN, 100)).toThrow(MoneyError);
  });
});

describe('roundToWhole', () => {
  it('rounds to the nearest whole rupee, in paise', () => {
    expect(roundToWhole(12350)).toBe(12400);
    expect(roundToWhole(12349)).toBe(12300);
    expect(roundToWhole(12300)).toBe(12300);
  });
});

describe('sum', () => {
  it('adds minor units', () => {
    expect(sum([100, 250, 5])).toBe(355);
    expect(sum([])).toBe(0);
  });
});

describe('percentOf: non-finite rate', () => {
  it('throws MoneyError for NaN and Infinity', () => {
    expect(() => percentOf(1000, NaN)).toThrow(MoneyError);
    expect(() => percentOf(1000, Infinity)).toThrow(MoneyError);
  });
});
