import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteHeader } from './SiteHeader';

const props = {
  links: [
    { label: 'Tools', href: '/#tools' },
    { label: 'Privacy', href: '/privacy/' },
  ],
  cta: { label: 'Create an invoice', href: '/tools/invoice/' },
};

describe('SiteHeader', () => {
  it('shows the logo, primary navigation and the call to action', () => {
    render(<SiteHeader {...props} />);
    expect(screen.getByRole('link', { name: 'SoloKit home' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Tools' })).toHaveAttribute('href', '/#tools');
    expect(within(nav).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy/');
    expect(screen.getByRole('link', { name: 'Create an invoice' })).toHaveAttribute('href', '/tools/invoice/');
  });
});
