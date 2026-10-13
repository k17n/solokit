import { describe, expect, it } from 'vitest';
import { INDIA, getAvailableCountries, getCountries } from './countries';

describe('countries', () => {
  it('lists India as available', () => {
    expect(INDIA).toMatchObject({ code: 'IN', currency: 'INR', status: 'available' });
    expect(getAvailableCountries()).toEqual([INDIA]);
  });

  it('lists other countries as coming soon', () => {
    const others = getCountries().filter((country) => country.code !== 'IN');
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((country) => country.status === 'coming-soon')).toBe(true);
  });

  it('has unique country codes', () => {
    const codes = getCountries().map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
