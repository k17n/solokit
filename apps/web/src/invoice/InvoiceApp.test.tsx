import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type DataStore } from '@solokit/storage';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeSeller } from '@solokit/tool-invoice/testing';
import { StoreProvider } from '../store/StoreProvider';
import { InvoiceApp } from './InvoiceApp';

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error remove the stub between tests
  delete navigator.storage;
});

function renderApp(store: DataStore = createMemoryStore()) {
  render(
    <StoreProvider factory={() => store}>
      <InvoiceApp />
    </StoreProvider>,
  );
  return store;
}

async function seedProfile(store: DataStore) {
  const storage = createInvoiceStorage(store);
  await storage.profile.save(makeSeller());
  await storage.settings.update({ onboarded: true });
}

describe('InvoiceApp first run', () => {
  it('waits for storage, then shows onboarding with no tabs', async () => {
    renderApp();
    expect(screen.getByText('Opening your invoices…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Set up your business' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Invoices' })).not.toBeInTheDocument();
  });

  it('saves the profile and opens the tool when onboarding is finished', async () => {
    const store = renderApp();
    await screen.findByRole('heading', { name: 'Set up your business' });
    await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Ravi Kumar');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByRole('tab', { name: 'Invoices' })).toHaveAttribute('aria-selected', 'true');
    const storage = createInvoiceStorage(store);
    expect((await storage.profile.get())?.name).toBe('Ravi Kumar');
    expect((await storage.settings.get()).onboarded).toBe(true);
  });
});

describe('InvoiceApp with a saved profile', () => {
  it('goes straight to the tool, with the Invoices tab selected', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    expect(await screen.findByRole('navigation', { name: 'Invoice tool' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Invoices' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('heading', { name: 'Set up your business' })).not.toBeInTheDocument();
  });

  it('shows the saved profile in the Profile tab and saves changes', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    await userEvent.click(await screen.findByRole('tab', { name: 'Profile' }));
    const name = screen.getByLabelText('Business or personal name');
    expect(name).toHaveValue('Asha Rao Consulting');
    await userEvent.clear(name);
    await userEvent.type(name, 'Asha Rao Advisory');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect((await createInvoiceStorage(store).profile.get())?.name).toBe('Asha Rao Advisory');
  });

  it('warns when the browser is not keeping data between visits', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <StoreProvider
        factory={() => {
          throw new Error('blocked');
        }}
      >
        <InvoiceApp />
      </StoreProvider>,
    );
    const notice = await screen.findByText('Your browser is not saving data');
    expect(notice).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('download a backup');
  });

  it('does not warn when storage works', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    await screen.findByRole('navigation', { name: 'Invoice tool' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('asks the browser to keep the data, once', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    await screen.findByRole('navigation', { name: 'Invoice tool' });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
  });
});
