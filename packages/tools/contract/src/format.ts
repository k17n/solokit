import { amountInWords } from '@solokit/core';
import { formatDate } from './dates';
import type { UnitName, VariableDef } from './library-types';
import type { VariableValue } from './model';

const UNIT_WORDS: Record<Exclude<UnitName, 'percent'>, readonly [string, string]> = {
  days: ['day', 'days'],
  months: ['month', 'months'],
  years: ['year', 'years'],
  hours: ['hour', 'hours'],
  rounds: ['round', 'rounds'],
};

/** "INR 50,000" or "INR 1,250.50": rupees with Indian digit grouping, no decimals when the amount is whole. */
export function formatRupees(rupees: number): string {
  const whole = Number.isInteger(rupees);
  const text = new Intl.NumberFormat('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }).format(rupees);
  return `INR ${text}`;
}

/** "INR 50,000 (Fifty Thousand Rupees Only)": the figure and the words, so the two can be checked against each other. */
export function formatRupeesWithWords(rupees: number): string {
  return `${formatRupees(rupees)} (${amountInWords(Math.round(rupees * 100))})`;
}

/** The unit word that goes with a number: "day" for 1, "days" otherwise. Percent has no word of its own. */
export function unitWord(value: number, unit: UnitName): string {
  if (unit === 'percent') return 'percent';
  const [one, many] = UNIT_WORDS[unit];
  return value === 1 ? one : many;
}

/** Plain count with its unit: "1 day", "15 days", "30%". */
export function formatCount(value: number, unit: UnitName | undefined): string {
  if (unit === 'percent') return `${value}%`;
  if (!unit) return String(value);
  return `${value} ${unitWord(value, unit)}`;
}

/** Strips spaces and trailing full stops, semicolons, colons and commas from text that goes in the middle of a sentence. */
export function tidyInline(value: string): string {
  return value.trim().replace(/[\s.;:,]+$/u, '');
}

/** How a variable's value reads inside the agreement. */
export function formatValue(def: VariableDef, value: VariableValue): string {
  switch (def.type) {
    case 'money':
      return formatRupeesWithWords(Number(value));
    case 'date':
      return formatDate(String(value));
    case 'integer':
    case 'number':
      return formatCount(Number(value), def.unit);
    case 'text':
    case 'longtext':
      return def.inline ? tidyInline(String(value)) : String(value).trim();
  }
}

/** Replaces the party tokens in choice labels and summaries. */
export function fillPartyTerms(text: string, a: string, b: string): string {
  return text.replaceAll('{{a}}', a).replaceAll('{{b}}', b);
}
