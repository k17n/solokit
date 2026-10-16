import { parseMoney, type Minor } from '@solokit/core';

/** "3,000.50" -> 300050. Null for empty, negative, or more than two decimals. */
export function parseAmountInput(text: string): Minor | null {
  const minor = parseMoney(text);
  return minor === null || minor < 0 ? null : minor;
}

/** 300050 -> "3000.50", 300000 -> "3000". For filling an input from a saved amount. */
export function formatAmountInput(minor: Minor): string {
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0')}`;
}

/** A quantity of at least 0.001 with at most three decimals. */
export function parseQuantityInput(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value >= 0.001 ? value : null;
}

export function formatQuantityInput(quantity: number): string {
  return Number(quantity.toFixed(3)).toString();
}

/** 0 to 100 with up to four decimals. */
export function parsePercentInput(text: string): number | null {
  const cleaned = text.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value <= 100 ? value : null;
}
