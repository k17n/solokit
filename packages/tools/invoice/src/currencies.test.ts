import { describe, expect, it } from 'vitest';
import { SUPPORTED_CURRENCIES, formatAmount, isCurrencyCode, localeForCurrency } from './currencies';

describe('currencies', () => {
  it('supports INR, USD, EUR and GBP', () => {
    expect(SUPPORTED_CURRENCIES.map((currency) => currency.code)).toEqual(['INR', 'USD', 'EUR', 'GBP']);
  });

  it('recognises supported codes only', () => {
    expect(isCurrencyCode('INR')).toBe(true);
    expect(isCurrencyCode('JPY')).toBe(false);
    expect(isCurrencyCode('inr')).toBe(false);
  });

  it('picks a sensible locale per currency', () => {
    expect(localeForCurrency('INR')).toBe('en-IN');
    expect(localeForCurrency('USD')).toBe('en-US');
  });

  it('formats amounts with the right symbol and grouping', () => {
    expect(formatAmount(12345600, 'INR')).toBe('₹1,23,456.00');
    expect(formatAmount(123456, 'USD')).toBe('$1,234.56');
    expect(formatAmount(123456, 'EUR')).toBe('€1,234.56');
    expect(formatAmount(123456, 'GBP')).toBe('£1,234.56');
    expect(formatAmount(-5000, 'INR')).toBe('-₹50.00');
  });
});
