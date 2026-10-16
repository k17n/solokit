import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getTools } from '@solokit/registry';
vi.mock('./tools', () => ({
  TOOL_COMPONENTS: { invoice: () => <p>Invoice tool is here</p> },
}));

import ToolPage, { generateMetadata, generateStaticParams } from '../app/tools/[slug]/page';

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe('tool route', () => {
  it('pre-renders a page for every registry tool', () => {
    expect(generateStaticParams()).toEqual(getTools().map((tool) => ({ slug: tool.slug })));
  });

  it('sets the page title from the tool name', async () => {
    const metadata = await generateMetadata(params('invoice'));
    expect(metadata.title).toBe('Invoice generator');
    expect(metadata.description).toContain('GST');
  });

  it('shows a coming-soon page for tools that are not built yet', async () => {
    render(await ToolPage(params('rate-calculator')));
    expect(screen.getByRole('heading', { level: 1, name: 'Hourly rate calculator' })).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse all tools' })).toHaveAttribute('href', '/#tools');
  });

  it('answers 404 for an unknown tool', async () => {
    await expect(ToolPage(params('does-not-exist'))).rejects.toThrow();
  });
});

describe('tool route with a registered tool component', () => {
  it('shows the tool instead of the coming-soon notice', async () => {
    render(await ToolPage(params('invoice')));
    expect(screen.getByRole('heading', { level: 1, name: 'Invoice generator' })).toBeInTheDocument();
    expect(screen.getByText('Invoice tool is here')).toBeInTheDocument();
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  });

  it('keeps the coming-soon notice for tools without a component', async () => {
    render(await ToolPage(params('rate-calculator')));
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
});
