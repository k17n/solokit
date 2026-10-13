import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('Logo', () => {
  it('links home and shows the wordmark', () => {
    render(<Logo />);
    const link = screen.getByRole('link', { name: 'SoloKit home' });
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveTextContent('SoloKit');
  });

  it('keeps the same accessible name at size lg', () => {
    render(<Logo size="lg" />);
    expect(screen.getByRole('link', { name: 'SoloKit home' })).toHaveAttribute('href', '/');
  });

  it('accepts a custom href', () => {
    render(<Logo href="/privacy/" />);
    expect(screen.getByRole('link', { name: 'SoloKit home' })).toHaveAttribute('href', '/privacy/');
  });
});
