import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToolGrid } from './ToolGrid';

vi.mock('@solokit/registry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@solokit/registry')>()),
  getTools: () => [
    { slug: 'alpha', name: 'Alpha tool', tagline: 'First', description: 'd', category: 'money', status: 'available' },
    { slug: 'beta', name: 'Beta tool', tagline: 'Second', description: 'd', category: 'clients', status: 'coming-soon' },
  ],
}));

describe('ToolGrid', () => {
  it('links available tools with a Ready badge', () => {
    render(<ToolGrid />);
    const section = screen.getByRole('region', { name: 'Tools' });
    const link = within(section).getByRole('link', { name: /Alpha tool/ });
    expect(link).toHaveAttribute('href', '/tools/alpha/');
    expect(within(link).getByText('Ready')).toBeInTheDocument();
  });

  it('shows ready tools in their own group before the coming-soon group', () => {
    render(<ToolGrid />);
    const ready = screen.getByRole('heading', { level: 3, name: 'Ready to use' });
    const soon = screen.getByRole('heading', { level: 3, name: 'On the way' });
    expect(ready.compareDocumentPosition(soon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: /Alpha tool/ }).compareDocumentPosition(soon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Beta tool').compareDocumentPosition(soon) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('does not link coming-soon tools and labels them', () => {
    render(<ToolGrid />);
    const section = screen.getByRole('region', { name: 'Tools' });
    expect(within(section).queryByRole('link', { name: /Beta tool/ })).toBeNull();
    expect(within(section).getByText('Beta tool')).toBeInTheDocument();
    expect(within(section).getByText('Coming soon')).toBeInTheDocument();
  });
});
