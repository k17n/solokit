import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type DataStore } from '@solokit/storage';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
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
    expect(screen.getByText('Opening your invoices…')).toBeInTheDocument();
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

describe('InvoiceApp: invoices', () => {
  const fakeRender = async () => new Blob(['pdf'], { type: 'application/pdf' });

  beforeEach(() => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:app'), revokeObjectURL: vi.fn() });
  });

  async function openApp(invoices: ReturnType<typeof makeInvoice>[] = []) {
    const store = createMemoryStore();
    await seedProfile(store);
    const storage = createInvoiceStorage(store);
    for (const invoice of invoices) await storage.invoices.save(invoice);
    render(
      <StoreProvider factory={() => store}>
        <InvoiceApp renderPdf={fakeRender} now={() => new Date(2026, 9, 14, 10, 0)} />
      </StoreProvider>,
    );
    await screen.findByRole('navigation', { name: 'Invoice tool' });
    return { store, storage };
  }

  it('shows the invoice list first, with the navigation buttons', async () => {
    await openApp();
    expect(screen.getByRole('button', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'New invoice' })).not.toHaveAttribute('aria-current');
    expect(await screen.findByText('No invoices yet.')).toBeInTheDocument();
  });

  it('opens the editor from the list and from the navigation, and goes back', async () => {
    await openApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Create your first invoice' }));
    expect(await screen.findByRole('heading', { name: 'New invoice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New invoice', current: 'page' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to invoices' }));
    expect(await screen.findByText('No invoices yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New invoice' }));
    expect(await screen.findByRole('heading', { name: 'New invoice' })).toBeInTheDocument();
  });

  it('starts a fresh invoice when "New invoice" is chosen while already on it', async () => {
    await openApp();
    await userEvent.click(screen.getByRole('button', { name: 'New invoice' }));
    await userEvent.type(await screen.findByLabelText('Client name'), 'Half typed');
    expect(screen.getByLabelText('Client name')).toHaveValue('Half typed');
    await userEvent.click(screen.getByRole('button', { name: 'New invoice' }));
    await waitFor(() => expect(screen.getByLabelText('Client name')).toHaveValue(''));
  });

  it('opens a draft from the list in the editor', async () => {
    await openApp([makeInvoice({ id: 'd1', number: '2026-27/0005', status: 'draft' })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Open 2026-27/0005' }));
    expect(await screen.findByRole('heading', { name: 'Edit draft' })).toBeInTheDocument();
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0005');
  });

  it('opens an issued invoice in the viewer', async () => {
    await openApp([makeInvoice({ id: 'i1', status: 'issued' })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Open 2026-27/0001' }));
    expect(await screen.findByRole('heading', { name: '2026-27/0001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows the viewer after an invoice is issued', async () => {
    await openApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Create your first invoice' }));
    await userEvent.type(await screen.findByLabelText('Client name'), 'Northwind Traders');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 MG Road');
    await userEvent.type(screen.getByLabelText('City'), 'Pune');
    await userEvent.selectOptions(screen.getByLabelText('State'), '27');
    const item = within(screen.getByRole('group', { name: 'Item 1' }));
    await userEvent.type(item.getByLabelText('Description'), 'Consulting');
    await userEvent.clear(item.getByLabelText('Quantity'));
    await userEvent.type(item.getByLabelText('Quantity'), '24');
    await userEvent.type(item.getByLabelText('Rate (₹)'), '3000');
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    expect(await screen.findByRole('button', { name: 'Duplicate as new draft' })).toBeInTheDocument();
    expect(screen.getByText('Issued')).toBeInTheDocument();
  });
});

describe('InvoiceApp: themes and backup tabs', () => {
  beforeEach(() => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:app'), revokeObjectURL: vi.fn() });
  });

  it('opens the Themes tab', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    await userEvent.click(await screen.findByRole('button', { name: 'Themes' }));
    expect(screen.getByRole('button', { name: 'Themes' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('list', { name: 'Themes' })).toBeInTheDocument();
  });

  it('opens the Backup & restore tab, also in a browser that is not saving data', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    await userEvent.click(await screen.findByRole('button', { name: 'Backup & restore' }));
    expect(screen.getByRole('button', { name: 'Backup & restore' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('button', { name: 'Download backup' })).toBeInTheDocument();
  });

  it('shows the reminder on the invoice list and its button opens the Backup tab', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    await createInvoiceStorage(store).invoices.save(makeInvoice({ id: 'x' }));
    renderApp(store);
    await userEvent.click(await screen.findByRole('button', { name: 'Back up now' }));
    expect(await screen.findByRole('button', { name: 'Download backup' })).toBeInTheDocument();
  });

  it('shows the restored profile after a restore without reloading', async () => {
    const other = createMemoryStore();
    await createInvoiceStorage(other).profile.save(makeSeller({ name: 'Restored Co' }));
    const { createBackup } = await import('@solokit/tool-invoice');
    const { json } = await createBackup(other);

    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    await userEvent.click(await screen.findByRole('button', { name: 'Backup & restore' }));
    await userEvent.upload(await screen.findByLabelText('Backup file'), new File([json], 'b.json', { type: 'application/json' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, replace my data' }));
    await screen.findByText(/Backup restored/);
    await userEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(screen.getByLabelText('Business or personal name')).toHaveValue('Restored Co');
  });
});
