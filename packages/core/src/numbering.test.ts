import { describe, expect, it } from 'vitest';
import {
  InvoiceNumberError,
  MAX_INVOICE_NUMBER_LENGTH,
  formatInvoiceNumber,
  indianFiscalYear,
  nextSequence,
} from './numbering';

describe('indianFiscalYear', () => {
  it('starts the year on 1 April', () => {
    expect(indianFiscalYear('2026-04-01')).toBe('2026-27');
    expect(indianFiscalYear('2026-10-13')).toBe('2026-27');
    expect(indianFiscalYear('2027-03-31')).toBe('2026-27');
    expect(indianFiscalYear('2026-03-31')).toBe('2025-26');
    expect(indianFiscalYear('2026-01-15')).toBe('2025-26');
  });

  it('rejects anything that is not an ISO date', () => {
    expect(() => indianFiscalYear('13/10/2026')).toThrow(InvoiceNumberError);
    expect(() => indianFiscalYear('2026-13-01')).toThrow(InvoiceNumberError);
  });
});

describe('formatInvoiceNumber', () => {
  it('builds a padded financial-year number', () => {
    expect(formatInvoiceNumber({ fiscalYear: '2026-27', sequence: 1 })).toBe('2026-27/0001');
    expect(formatInvoiceNumber({ fiscalYear: '2026-27', sequence: 123 })).toBe('2026-27/0123');
  });

  it('supports a prefix and stops at the 16-character GST limit', () => {
    const number = formatInvoiceNumber({ prefix: 'INV/', fiscalYear: '2026-27', sequence: 1 });
    expect(number).toBe('INV/2026-27/0001');
    expect(number).toHaveLength(MAX_INVOICE_NUMBER_LENGTH);
  });

  it('rejects numbers longer than 16 characters', () => {
    expect(() =>
      formatInvoiceNumber({ prefix: 'INVOICE/', fiscalYear: '2026-27', sequence: 1 }),
    ).toThrow(InvoiceNumberError);
    expect(() =>
      formatInvoiceNumber({ fiscalYear: '2026-27', sequence: 1_000_000_000_000 }),
    ).toThrow(InvoiceNumberError);
  });

  it('rejects characters other than letters, digits, slash and hyphen', () => {
    expect(() =>
      formatInvoiceNumber({ prefix: 'A B/', fiscalYear: '2026-27', sequence: 1 }),
    ).toThrow(InvoiceNumberError);
  });

  it('rejects sequences below 1 or non-integers', () => {
    expect(() => formatInvoiceNumber({ fiscalYear: '2026-27', sequence: 0 })).toThrow(InvoiceNumberError);
    expect(() => formatInvoiceNumber({ fiscalYear: '2026-27', sequence: 1.5 })).toThrow(InvoiceNumberError);
  });
});

describe('nextSequence', () => {
  it('starts at 1 when nothing exists', () => {
    expect(nextSequence([], '2026-27')).toBe(1);
  });

  it('continues after the highest number in the same fiscal year', () => {
    expect(nextSequence(['2026-27/0001', '2026-27/0007', '2025-26/0099'], '2026-27')).toBe(8);
  });

  it('ignores prefixes and unrelated numbers', () => {
    expect(nextSequence(['INV/2026-27/0003', 'custom-number'], '2026-27')).toBe(4);
  });
});
