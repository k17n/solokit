export class InvoiceNumberError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceNumberError';
  }
}

/** GST rule: an invoice number is at most 16 characters of letters, digits, "/" and "-". */
export const MAX_INVOICE_NUMBER_LENGTH = 16;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ALLOWED_CHARACTERS = /^[A-Za-z0-9/-]+$/;
const FISCAL_SEQUENCE = /(\d{4}-\d{2})\/(\d+)$/;

/** Indian financial year label for an ISO date (YYYY-MM-DD): "2026-04-01" -> "2026-27". */
export function indianFiscalYear(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate);
  const month = match ? Number(match[2]) : 0;
  if (!match || month < 1 || month > 12) {
    throw new InvoiceNumberError(`Expected an ISO date (YYYY-MM-DD), got "${isoDate}"`);
  }
  const year = Number(match[1]);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export interface InvoiceNumberParts {
  prefix?: string;
  fiscalYear: string;
  sequence: number;
  pad?: number;
}

export function formatInvoiceNumber({ prefix = '', fiscalYear, sequence, pad = 4 }: InvoiceNumberParts): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new InvoiceNumberError(`Sequence must be a positive integer, got ${sequence}`);
  }
  const number = `${prefix}${fiscalYear}/${String(sequence).padStart(pad, '0')}`;
  if (number.length > MAX_INVOICE_NUMBER_LENGTH) {
    throw new InvoiceNumberError(
      `Invoice number "${number}" is ${number.length} characters; GST allows at most ${MAX_INVOICE_NUMBER_LENGTH}`,
    );
  }
  if (!ALLOWED_CHARACTERS.test(number)) {
    throw new InvoiceNumberError(`Invoice number "${number}" may only contain letters, digits, "/" and "-"`);
  }
  return number;
}

/** The next sequence for a fiscal year, given the invoice numbers already issued. */
export function nextSequence(existingNumbers: string[], fiscalYear: string): number {
  let highest = 0;
  for (const number of existingNumbers) {
    const match = FISCAL_SEQUENCE.exec(number);
    if (match && match[1] === fiscalYear) {
      highest = Math.max(highest, Number(match[2]));
    }
  }
  return highest + 1;
}
