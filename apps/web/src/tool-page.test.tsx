import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getTools } from '@solokit/registry';
vi.mock('./tools', () => ({
  TOOL_COMPONENTS: { invoice: () => <p>Invoice tool is here</p> },
}));

import ToolPage, { generateMetadata, generateStaticParams } from '../app/(site)/tools/[slug]/page';
import AppToolPage, { generateMetadata as appMetadata, generateStaticParams as appStaticParams } from '../app/app/[tool]/page';

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
const appParams = (tool: string) => ({ params: Promise.resolve({ tool }) });

describe('tool landing pages on the site', () => {
  it('pre-renders a page for every registry tool', () => {
    expect(generateStaticParams()).toEqual(getTools().map((tool) => ({ slug: tool.slug })));
  });

  it('sets the page title and description from the tool, for search engines', async () => {
    const metadata = await generateMetadata(params('invoice'));
    expect(metadata.title).toBe('Invoice generator');
    expect(metadata.description).toContain('GST');
  });

  it('describes a ready tool and opens it in the app, without running it here', async () => {
    render(await ToolPage(params('invoice')));
    expect(screen.getByRole('heading', { level: 1, name: 'Invoice generator' })).toBeInTheDocument();
    expect(screen.getByText(/tax invoices, bills of supply/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the invoice generator' })).toHaveAttribute('href', '/app/invoice/');
    expect(screen.queryByText('Invoice tool is here')).not.toBeInTheDocument();
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
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

describe('tools inside the app', () => {
  it('pre-renders an app page only for ready tools that have a component', () => {
    expect(appStaticParams()).toEqual([{ tool: 'invoice' }]);
  });

  it('runs the tool, and keeps the page out of search engines', async () => {
    render(await AppToolPage(appParams('invoice')));
    expect(screen.getByRole('heading', { level: 1, name: 'Invoice generator' })).toBeInTheDocument();
    expect(screen.getByText('Invoice tool is here')).toBeInTheDocument();
    expect((await appMetadata(appParams('invoice'))).robots).toEqual({ index: false });
  });

  it('answers 404 for a tool that is not ready', async () => {
    await expect(AppToolPage(appParams('rate-calculator'))).rejects.toThrow();
  });
});
