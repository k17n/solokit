import { formatMoney, type Minor } from '@solokit/core';

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', name: 'Indian rupee', symbol: '₹', locale: 'en-IN' },
  { code: 'USD', name: 'US dollar', symbol: '$', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'en-IE' },
  { code: 'GBP', name: 'Pound sterling', symbol: '£', locale: 'en-GB' },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code'];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return SUPPORTED_CURRENCIES.some((currency) => currency.code === value);
}

export function localeForCurrency(code: CurrencyCode): string {
  const found = SUPPORTED_CURRENCIES.find((currency) => currency.code === code);
  return found ? found.locale : 'en-US';
}

export function formatAmount(minor: Minor, code: CurrencyCode): string {
  return formatMoney(minor, code, localeForCurrency(code));
}
