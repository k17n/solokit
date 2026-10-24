import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Forward } from './Forward';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Forward', () => {
  it('sends an old address on, keeping its query and section, and offers a link meanwhile', () => {
    const replace = vi.fn();
    vi.stubGlobal('location', { search: '?next=%2Fapp%2Finvoice%2F', hash: '#payments', replace });
    render(<Forward to="/app/setup/" label="Business setup" />);
    expect(replace).toHaveBeenCalledWith('/app/setup/?next=%2Fapp%2Finvoice%2F#payments');
    expect(screen.getByRole('link', { name: 'Go to Business setup' })).toHaveAttribute('href', '/app/setup/');
  });
});
