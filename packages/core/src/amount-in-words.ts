import { assertMinor, type Minor } from './money';

type Numbering = 'indian' | 'international';

interface CurrencyWords {
  major: readonly [singular: string, plural: string];
  minor: readonly [singular: string, plural: string];
  numbering: Numbering;
}

const CURRENCIES: Record<string, CurrencyWords> = {
  INR: { major: ['Rupee', 'Rupees'], minor: ['Paisa', 'Paise'], numbering: 'indian' },
  USD: { major: ['US Dollar', 'US Dollars'], minor: ['Cent', 'Cents'], numbering: 'international' },
  EUR: { major: ['Euro', 'Euros'], minor: ['Cent', 'Cents'], numbering: 'international' },
  GBP: { major: ['Pound', 'Pounds'], minor: ['Penny', 'Pence'], numbering: 'international' },
};

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const UNITS: Record<Numbering, ReadonlyArray<readonly [size: number, name: string]>> = {
  indian: [[10_000_000, 'Crore'], [100_000, 'Lakh'], [1_000, 'Thousand']],
  international: [[1_000_000_000, 'Billion'], [1_000_000, 'Million'], [1_000, 'Thousand']],
};

function below100(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const tens = TENS[Math.floor(n / 10)] ?? '';
  const ones = ONES[n % 10] ?? '';
  return ones ? `${tens}-${ones}` : tens;
}

function below1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds] ?? ''} Hundred`);
  if (rest) parts.push(below100(rest));
  return parts.join(' ');
}

function integerToWords(n: number, numbering: Numbering): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  let rest = n;
  for (const [size, name] of UNITS[numbering]) {
    const count = Math.floor(rest / size);
    if (count > 0) {
      parts.push(`${integerToWords(count, numbering)} ${name}`);
      rest -= count * size;
    }
  }
  if (rest > 0) parts.push(below1000(rest));
  return parts.join(' ');
}

/** e.g. amountInWords(123456) -> "One Thousand Two Hundred Thirty-Four Rupees and Fifty-Six Paise Only" */
export function amountInWords(minor: Minor, currency = 'INR'): string {
  assertMinor(minor);
  if (minor < 0) throw new RangeError('amountInWords does not support negative amounts');
  const words = Object.hasOwn(CURRENCIES, currency) ? CURRENCIES[currency] : undefined;
  if (!words) throw new RangeError(`Unsupported currency for amount in words: ${currency}`);

  const major = Math.floor(minor / 100);
  const fraction = minor % 100;
  const label = (n: number, names: readonly [string, string]) => (n === 1 ? names[0] : names[1]);

  const parts: string[] = [];
  if (major > 0 || fraction === 0) {
    parts.push(`${integerToWords(major, words.numbering)} ${label(major, words.major)}`);
  }
  if (fraction > 0) {
    parts.push(`${integerToWords(fraction, words.numbering)} ${label(fraction, words.minor)}`);
  }
  return `${parts.join(' and ')} Only`;
}
