import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getTools } from '@solokit/registry';
import Home from '../../app/page';

describe('Home page', () => {
  it('leads with the promise and the main call to action', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Paperwork for one-person businesses.');
    expect(screen.getByRole('link', { name: 'Create an invoice' })).toHaveAttribute('href', '/tools/invoice/');
    expect(screen.getByRole('link', { name: 'See all tools' })).toHaveAttribute('href', '/#tools');
  });

  it('shows the live GST example', () => {
    render(<Home />);
    expect(screen.getByRole('region', { name: 'Live GST example' })).toBeInTheDocument();
  });

  it('states the trust points', () => {
    render(<Home />);
    const strip = screen.getByRole('list', { name: 'Why people trust it' });
    for (const text of ['Free', 'No signup', 'Works offline', 'Data stays on your device']) {
      expect(within(strip).getByText(text)).toBeInTheDocument();
    }
  });

  it('lists every registry tool, linking only the ones that are available', () => {
    render(<Home />);
    const section = screen.getByRole('region', { name: 'Tools' });
    for (const tool of getTools()) {
      expect(within(section).getByText(tool.name)).toBeInTheDocument();
      const link = within(section).queryByRole('link', { name: new RegExp(tool.name) });
      if (tool.status === 'available') expect(link).toBeInTheDocument();
      else expect(link).not.toBeInTheDocument();
    }
  });

  it('explains why local-first matters', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: 'Nothing is uploaded' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Works without internet' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Back up when you like' })).toBeInTheDocument();
  });

  it('has a single main landmark the skip link can target', () => {
    render(<Home />);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });
});
