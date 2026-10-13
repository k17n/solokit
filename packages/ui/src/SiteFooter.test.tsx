import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteFooter } from './SiteFooter';

const props = {
  tools: [
    { label: 'Invoice generator', href: '/tools/invoice/', status: 'available' as const },
    { label: 'Quote generator', href: '/tools/quote/', status: 'coming-soon' as const },
  ],
  countries: [
    { code: 'IN', name: 'India', status: 'available' as const },
    { code: 'US', name: 'United States', status: 'coming-soon' as const },
  ],
  projectLinks: [
    { label: 'Home', href: '/' },
    { label: 'Privacy', href: '/privacy/' },
  ],
  rulesAsOf: '2026-10-13',
};

describe('SiteFooter', () => {
  it('states the privacy promise and offers a way back to the top', () => {
    render(<SiteFooter {...props} />);
    expect(screen.getByText('Your paperwork stays on your device.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument();
  });

  it('links available tools and marks the rest as coming soon', () => {
    render(<SiteFooter {...props} />);
    const tools = screen.getByRole('navigation', { name: 'Tools' });
    expect(within(tools).getByRole('link', { name: 'Invoice generator' })).toHaveAttribute('href', '/tools/invoice/');
    expect(within(tools).queryByRole('link', { name: 'Quote generator' })).not.toBeInTheDocument();
    expect(within(tools).getByText('Quote generator')).toBeInTheDocument();
    expect(within(tools).getAllByText('Coming soon')).toHaveLength(1);
  });

  it('lists countries with India available and others coming soon', () => {
    render(<SiteFooter {...props} />);
    const countries = screen.getByRole('region', { name: 'Countries' });
    expect(within(countries).getByText('India')).toBeInTheDocument();
    expect(within(countries).getByText('Available')).toBeInTheDocument();
    expect(within(countries).getByText('United States')).toBeInTheDocument();
    expect(within(countries).getByText('Coming soon')).toBeInTheDocument();
  });

  it('shows project links, the tax disclaimer with the date, and the made-in-India line', () => {
    render(<SiteFooter {...props} />);
    const project = screen.getByRole('navigation', { name: 'Project' });
    expect(within(project).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy/');
    expect(screen.getByText(/Tax rules last checked 13 Oct 2026/)).toBeInTheDocument();
    expect(screen.getByText(/not tax advice/i)).toBeInTheDocument();
    expect(screen.getByText('Made in India')).toBeInTheDocument();
  });
});
