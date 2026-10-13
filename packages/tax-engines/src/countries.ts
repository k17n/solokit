import type { CountryInfo } from './types';

export const INDIA: CountryInfo = { code: 'IN', name: 'India', currency: 'INR', status: 'available' };

const COUNTRIES: readonly CountryInfo[] = [
  INDIA,
  { code: 'US', name: 'United States', currency: 'USD', status: 'coming-soon' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', status: 'coming-soon' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', status: 'coming-soon' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', status: 'coming-soon' },
  { code: 'AU', name: 'Australia', currency: 'AUD', status: 'coming-soon' },
  { code: 'CA', name: 'Canada', currency: 'CAD', status: 'coming-soon' },
];

export function getCountries(): CountryInfo[] {
  return [...COUNTRIES];
}

export function getAvailableCountries(): CountryInfo[] {
  return COUNTRIES.filter((country) => country.status === 'available');
}
