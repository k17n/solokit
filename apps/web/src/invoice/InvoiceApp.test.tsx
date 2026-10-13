import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { StoreProvider } from '../store/StoreProvider';
import { InvoiceApp } from './InvoiceApp';

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error remove the stub between tests
  delete navigator.storage;
});

function renderApp(factory = createMemoryStore) {
  return render(
    <StoreProvider factory={factory}>
      <InvoiceApp />
    </StoreProvider>,
  );
}

describe('InvoiceApp shell', () => {
  it('waits for storage, then shows the tool navigation', async () => {
    renderApp();
    expect(screen.getByText('Opening your invoices…')).toBeInTheDocument();
    const nav = await screen.findByRole('navigation', { name: 'Invoice tool' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Invoices' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'false');
  });

  it('switches tabs', async () => {
    renderApp();
    await screen.findByRole('navigation', { name: 'Invoice tool' });
    await userEvent.click(screen.getByRole('tab', { name: 'Profile' }));
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Invoices' })).toHaveAttribute('aria-selected', 'false');
  });

  it('warns when the browser is not keeping data between visits', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderApp(() => {
      throw new Error('blocked');
    });
    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('Your browser is not saving data');
    expect(notice).toHaveTextContent('download a backup');
  });

  it('does not warn when storage works', async () => {
    renderApp();
    await screen.findByRole('navigation', { name: 'Invoice tool' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks the browser to keep the data, once', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
    renderApp();
    await screen.findByRole('navigation', { name: 'Invoice tool' });
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
