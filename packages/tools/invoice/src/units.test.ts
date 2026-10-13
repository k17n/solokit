import { describe, expect, it } from 'vitest';
import { BILLING_UNITS, BILLING_UNIT_LABELS, formatQuantity } from './units';

describe('billing units', () => {
  it('has a label for every unit', () => {
    for (const unit of BILLING_UNITS) expect(BILLING_UNIT_LABELS[unit]).toBeTruthy();
  });

  it('formats hours, days and months with correct singular and plural', () => {
    expect(formatQuantity(24, 'hours')).toBe('24 hrs');
    expect(formatQuantity(1, 'hours')).toBe('1 hr');
    expect(formatQuantity(7.5, 'hours')).toBe('7.5 hrs');
    expect(formatQuantity(3, 'days')).toBe('3 days');
    expect(formatQuantity(1, 'days')).toBe('1 day');
    expect(formatQuantity(2, 'months')).toBe('2 months');
    expect(formatQuantity(1, 'months')).toBe('1 month');
  });

  it('formats items as a bare number and trims trailing zeros', () => {
    expect(formatQuantity(5, 'items')).toBe('5');
    expect(formatQuantity(2.5, 'items')).toBe('2.5');
    expect(formatQuantity(1.2346, 'items')).toBe('1.235');
  });

  it('formats fixed fees and retainers', () => {
    expect(formatQuantity(1, 'fixed')).toBe('Fixed fee');
    expect(formatQuantity(2, 'fixed')).toBe('2 × fixed fee');
    expect(formatQuantity(1, 'retainer')).toBe('Retainer');
    expect(formatQuantity(3, 'retainer')).toBe('3 × retainer');
  });
});
