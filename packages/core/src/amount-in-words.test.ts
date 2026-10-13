import { describe, expect, it } from 'vitest';
import { amountInWords } from './amount-in-words';

describe('amountInWords (INR, Indian numbering)', () => {
  it('handles zero', () => {
    expect(amountInWords(0)).toBe('Zero Rupees Only');
  });

  it('uses singular for exactly one', () => {
    expect(amountInWords(100)).toBe('One Rupee Only');
    expect(amountInWords(1)).toBe('One Paisa Only');
  });

  it('speaks paise only when there are no rupees', () => {
    expect(amountInWords(50)).toBe('Fifty Paise Only');
  });

  it('combines rupees and paise', () => {
    expect(amountInWords(123456)).toBe(
      'One Thousand Two Hundred Thirty-Four Rupees and Fifty-Six Paise Only',
    );
  });

  it('uses lakh and crore', () => {
    expect(amountInWords(12345600)).toBe(
      'One Lakh Twenty-Three Thousand Four Hundred Fifty-Six Rupees Only',
    );
    expect(amountInWords(1_000_000_00 * 10)).toBe('One Crore Rupees Only');
    expect(amountInWords(150_000_000 * 100)).toBe('Fifteen Crore Rupees Only');
    expect(amountInWords(1_000_000_000 * 100)).toBe('One Hundred Crore Rupees Only');
  });

  it('handles teens and round tens', () => {
    expect(amountInWords(1900)).toBe('Nineteen Rupees Only');
    expect(amountInWords(7000)).toBe('Seventy Rupees Only');
    expect(amountInWords(10500)).toBe('One Hundred Five Rupees Only');
  });
});

describe('amountInWords (foreign currencies, international numbering)', () => {
  it('formats USD', () => {
    expect(amountInWords(123456, 'USD')).toBe(
      'One Thousand Two Hundred Thirty-Four US Dollars and Fifty-Six Cents Only',
    );
    expect(amountInWords(1_234_567_00, 'USD')).toBe(
      'One Million Two Hundred Thirty-Four Thousand Five Hundred Sixty-Seven US Dollars Only',
    );
  });

  it('formats GBP singular and plural minor units', () => {
    expect(amountInWords(1, 'GBP')).toBe('One Penny Only');
    expect(amountInWords(2, 'GBP')).toBe('Two Pence Only');
  });

  it('formats EUR', () => {
    expect(amountInWords(100, 'EUR')).toBe('One Euro Only');
  });
});

describe('amountInWords errors', () => {
  it('rejects negatives and unsupported currencies', () => {
    expect(() => amountInWords(-1)).toThrow(RangeError);
    expect(() => amountInWords(100, 'XYZ')).toThrow(RangeError);
  });
});
