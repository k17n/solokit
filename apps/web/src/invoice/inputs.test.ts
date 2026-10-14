import { describe, expect, it } from 'vitest';
import { newId } from './ids';
import {
  formatAmountInput,
  formatQuantityInput,
  parseAmountInput,
  parsePercentInput,
  parseQuantityInput,
} from './inputs';

describe('parseAmountInput', () => {
  it('turns typed amounts into minor units', () => {
    expect(parseAmountInput('3000')).toBe(300000);
    expect(parseAmountInput('3,000.50')).toBe(300050);
    expect(parseAmountInput(' 1,23,456.7 ')).toBe(12345670);
    expect(parseAmountInput('0')).toBe(0);
    expect(parseAmountInput('0.05')).toBe(5);
  });

  it('rejects empty, negative, text and more than two decimals', () => {
    for (const text of ['', '  ', '-5', 'abc', '1.234', '1e5', '.5', '5.']) {
      expect(parseAmountInput(text), text).toBeNull();
    }
  });
});

describe('formatAmountInput', () => {
  it('writes whole amounts without decimals and others with two', () => {
    expect(formatAmountInput(300000)).toBe('3000');
    expect(formatAmountInput(300050)).toBe('3000.50');
    expect(formatAmountInput(5)).toBe('0.05');
    expect(formatAmountInput(0)).toBe('0');
  });

  it('round-trips through the parser', () => {
    for (const minor of [0, 1, 99, 100, 123456, 987654321]) {
      expect(parseAmountInput(formatAmountInput(minor))).toBe(minor);
    }
  });
});

describe('parseQuantityInput', () => {
  it('accepts positive numbers with up to three decimals', () => {
    expect(parseQuantityInput('1')).toBe(1);
    expect(parseQuantityInput('7.5')).toBe(7.5);
    expect(parseQuantityInput('0.001')).toBe(0.001);
    expect(parseQuantityInput('1,000')).toBe(1000);
  });

  it('rejects zero, too many decimals, negatives and text', () => {
    for (const text of ['', '0', '0.0004', '1.2345', '-1', 'x', '1e3']) {
      expect(parseQuantityInput(text), text).toBeNull();
    }
  });
});

describe('formatQuantityInput', () => {
  it('trims trailing zeros', () => {
    expect(formatQuantityInput(24)).toBe('24');
    expect(formatQuantityInput(7.5)).toBe('7.5');
    expect(formatQuantityInput(1.235)).toBe('1.235');
  });
});

describe('parsePercentInput', () => {
  it('accepts 0 to 100 with up to four decimals', () => {
    expect(parsePercentInput('10')).toBe(10);
    expect(parsePercentInput('2.5')).toBe(2.5);
    expect(parsePercentInput('0')).toBe(0);
    expect(parsePercentInput('100')).toBe(100);
    expect(parsePercentInput('0.0001')).toBe(0.0001);
  });

  it('rejects out-of-range and malformed input', () => {
    for (const text of ['', '-1', '100.1', '101', 'ten', '1.23456', '5%']) {
      expect(parsePercentInput(text), text).toBeNull();
    }
  });
});

describe('newId', () => {
  it('gives different, non-empty ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id.length).toBeGreaterThan(8);
  });
});
