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

/** A store whose operations can be made to fail on demand. */
function flakyStore(inner: DataStore = createMemoryStore()) {
  const failures = {
    get: false,
    put: (_collection: string) => false,
  };
  const store: DataStore = {
    get: (collection, id) => (failures.get ? Promise.reject(new Error('read failed')) : inner.get(collection, id)),
    put: (collection, record) => (failures.put(collection) ? Promise.reject(new Error('write failed')) : inner.put(collection, record)),
    list: (collection) => inner.list(collection),
    remove: (collection, id) => inner.remove(collection, id),
    exportAll: () => inner.exportAll(),
    importAll: (snapshot) => inner.importAll(snapshot),
  };
  return { store, failures };
}

async function seedProfile(store: DataStore) {
  const storage = createInvoiceStorage(store);
  await storage.profile.save(makeSeller());
  await storage.settings.update({ onboarded: true });
}

describe('InvoiceApp first run', () => {
  it('waits for storage, then shows onboarding with no tabs', async () => {
    renderApp();
    expect(screen.getByText('Opening your invoicesâ€¦')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Set up your business' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invoices' })).not.toBeInTheDocument();
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
    expect(await screen.findByRole('button', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
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
    expect(screen.getByRole('button', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('heading', { name: 'Set up your business' })).not.toBeInTheDocument();
  });

  it('shows the saved profile in the Profile tab and saves changes', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    await userEvent.click(await screen.findByRole('button', { name: 'Profile' }));
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
    expect(screen.getByRole('alert')).toHaveTextContent('normal browser window');
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

  it('clears the Saved notice when a later save fails', async () => {
    const { store, failures } = flakyStore();
    await seedProfile(store);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp(store);
    await userEvent.click(await screen.findByRole('button', { name: 'Profile' }));
    const name = screen.getByLabelText('Business or personal name');
    await userEvent.type(name, ' Ltd');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    failures.put = () => true;
    await userEvent.type(screen.getByLabelText('Business or personal name'), ' and Co');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Your profile could not be saved. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('shows the saved, normalised values after saving', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    await userEvent.click(await screen.findByRole('button', { name: 'Profile' }));
    const pan = screen.getByLabelText('PAN');
    await userEvent.clear(pan);
    await userEvent.type(pan, '  aapfu0939f  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(screen.getByLabelText('PAN')).toHaveValue('AAPFU0939F');
  });
});

describe('InvoiceApp when storage misbehaves', () => {
  it('offers to try again when the saved profile cannot be read', async () => {
    const { store, failures } = flakyStore();
    await seedProfile(store);
    failures.get = true;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp(store);
    expect(await screen.findByText('Your saved details could not be opened')).toBeInTheDocument();
    expect(screen.queryByText('Opening your invoices…')).not.toBeInTheDocument();
    expect(error).toHaveBeenCalled();
    failures.get = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('navigation', { name: 'Invoice tool' })).toBeInTheDocument();
    expect(screen.queryByText('Your saved details could not be opened')).not.toBeInTheDocument();
  });

  it('still finishes onboarding when only the onboarded flag cannot be saved', async () => {
    const { store, failures } = flakyStore();
    failures.put = (collection) => collection === 'settings';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderApp(store);
    await screen.findByRole('heading', { name: 'Set up your business' });
    await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Ravi Kumar');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByRole('button', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
    expect(error).toHaveBeenCalled();
    expect((await createInvoiceStorage(store).profile.get())?.name).toBe('Ravi Kumar');
  });
});
