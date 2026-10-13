import { describe, expect, it } from 'vitest';
import { formatMoney } from '@solokit/core';
import { computeDemo } from './computeDemo';

describe('computeDemo', () => {
  it('splits 18% GST into CGST and SGST within the same state', () => {
    expect(computeDemo('1,00,000', true)).toEqual({
      taxable: '₹1,00,000.00',
      taxRows: [
        { label: 'CGST 9%', amount: '₹9,000.00' },
        { label: 'SGST 9%', amount: '₹9,000.00' },
      ],
      total: '₹1,18,000.00',
      words: 'One Lakh Eighteen Thousand Rupees Only',
    });
  });

  it('charges IGST outside the state', () => {
    const result = computeDemo('1,00,000', false);
    expect(result?.taxRows).toEqual([{ label: 'IGST 18%', amount: '₹18,000.00' }]);
    expect(result?.total).toBe('₹1,18,000.00');
  });

  it('shows the round-off line when the total is rounded to the rupee', () => {
    const result = computeDemo('333.33', true);
    expect(result?.taxRows).toEqual([
      { label: 'CGST 9%', amount: formatMoney(3000) },
      { label: 'SGST 9%', amount: formatMoney(3000) },
      { label: 'Round off', amount: formatMoney(-33) },
    ]);
    expect(result?.total).toBe(formatMoney(39300));
  });

  it('returns null for input that is not a usable amount', () => {
    for (const input of ['', 'abc', '0', '-5', '1.234', '1000000000.01']) {
      expect(computeDemo(input, true)).toBeNull();
    }
  });
});
