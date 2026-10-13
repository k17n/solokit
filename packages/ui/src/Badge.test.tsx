import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its text and tone', () => {
    render(<Badge tone="soon">Coming soon</Badge>);
    const badge = screen.getByText('Coming soon');
    expect(badge).toHaveAttribute('data-tone', 'soon');
  });

  it('defaults to the neutral tone', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toHaveAttribute('data-tone', 'neutral');
  });
});
