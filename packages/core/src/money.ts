/** All money in this codebase is an integer count of minor units (paise, cents). */
export type Minor = number;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function assertMinor(value: number, label = 'amount'): asserts value is Minor {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be a safe integer number of minor units, got ${value}`);
  }
}

const DECIMAL = /^(-?)(\d+)(?:\.(\d{1,2}))?$/;

/** Parses "1234.5" or "1,23,456.78" into minor units. Returns null for anything else. */
export function parseMoney(input: string): Minor | null {
  const match = DECIMAL.exec(input.trim().replace(/,/g, ''));
  if (!match) return null;
  const [, sign, whole, fraction = ''] = match;
  const minor = Number(whole) * 100 + Number((fraction + '0').slice(0, 2));
  if (!Number.isSafeInteger(minor)) return null;
  if (minor === 0) return 0;
  return sign === '-' ? -minor : minor;
}

/** Display formatting only. Never feed the result back into arithmetic. */
export function formatMoney(minor: Minor, currency = 'INR', locale = 'en-IN'): string {
  assertMinor(minor);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 100);
}

function roundedDiv(numerator: bigint, denominator: bigint): number {
  const negative = numerator < 0n;
  const n = negative ? -numerator : numerator;
  const quotient = n / denominator;
  const remainder = n % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return Number(negative ? -rounded : rounded);
}

/**
 * amount x ratePercent / 100, rounded half away from zero.
 * The rate may have up to four decimals (e.g. 2.5, 0.125). Uses BigInt so large amounts stay exact.
 */
export function percentOf(amount: Minor, ratePercent: number): Minor {
  assertMinor(amount);
  if (!Number.isFinite(ratePercent)) {
    throw new MoneyError(`ratePercent must be a finite number, got ${ratePercent}`);
  }
  const pips = Math.round(ratePercent * 10_000); // 1 pip = 0.0001 %
  return roundedDiv(BigInt(amount) * BigInt(pips), 1_000_000n);
}

/** quantity (up to three decimals, e.g. 7.5 hours) x unit rate, rounded to the nearest minor unit. */
export function lineAmount(quantity: number, unitRate: Minor): Minor {
  assertMinor(unitRate, 'unitRate');
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new MoneyError(`quantity must be a non-negative number, got ${quantity}`);
  }
  const milli = Math.round(quantity * 1000);
  return roundedDiv(BigInt(milli) * BigInt(unitRate), 1000n);
}

/** Rounds to the nearest whole rupee (100 paise), halves away from zero. */
export function roundToWhole(amount: Minor): Minor {
  assertMinor(amount);
  return roundedDiv(BigInt(amount), 100n) * 100;
}

export function sum(values: Minor[]): Minor {
  return values.reduce((total, value) => total + value, 0);
}
