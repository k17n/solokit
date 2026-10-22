import { describe, expect, it } from 'vitest';
import { IN_RULES_AS_OF } from '@solokit/tax-engines';
import { HEADER_PROPS, getFooterProps } from './site';

describe('site config', () => {
  it('keeps the website header about the website, with Get started into the app', () => {
    expect(HEADER_PROPS.cta).toEqual({ label: 'Get started', href: '/app/' });
    expect(HEADER_PROPS.links).toEqual([
      { label: 'Tools', href: '/#tools' },
      { label: 'How it works', href: '/#local' },
      { label: 'Privacy', href: '/privacy/' },
    ]);
  });

  it('builds footer tool links from the registry', () => {
    const { tools } = getFooterProps();
    const invoice = tools.find((tool) => tool.href === '/tools/invoice/');
    expect(invoice?.label).toBe('Invoice generator');
    expect(tools.length).toBeGreaterThan(1);
  });

  it('lists India as available and every other country as coming soon', () => {
    const { countries } = getFooterProps();
    expect(countries.find((country) => country.code === 'IN')?.status).toBe('available');
    expect(countries.filter((country) => country.code !== 'IN').every((country) => country.status === 'coming-soon')).toBe(true);
  });

  it('uses the India rules date for the tax disclaimer', () => {
    expect(getFooterProps().rulesAsOf).toBe(IN_RULES_AS_OF);
  });

  it('offers project links to pages that exist', () => {
    expect(getFooterProps().projectLinks).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Open SoloKit', href: '/app/' },
      { label: 'Privacy', href: '/privacy/' },
    ]);
  });
});
