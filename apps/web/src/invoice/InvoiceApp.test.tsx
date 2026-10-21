import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type DataStore } from '@solokit/storage';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { navigate } from '../setup/navigate';
import { StoreProvider } from '../store/StoreProvider';
import { InvoiceApp } from './InvoiceApp';

vi.mock('../setup/navigate', () => ({ navigate: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(navigate).mockClear();
  // @ts-expect-error remove the stub between tests
  delete navigator.storage;
});

function renderApp(store: DataStore = createMemoryStore(), { persistent = true } = {}) {
  render(
    <StoreProvider factory={() => store} persistent={persistent}>
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

describe('InvoiceApp before the business is set up', () => {
  it('waits for storage, then sends the person to setup, to come back here', async () => {
    renderApp();
    expect(screen.getByText('Opening your invoices…')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Go to setup' })).toHaveAttribute('href', '/app/setup/?next=%2Fapp%2Finvoice%2F');
    expect(navigate).toHaveBeenCalledWith('/app/setup/?next=%2Fapp%2Finvoice%2F', { replace: true });
    expect(screen.queryByRole('button', { name: 'Documents' })).not.toBeInTheDocument();
  });

  it('also sends a business to setup when a detail another tool needs is missing', async () => {
    const store = createMemoryStore();
    await createInvoiceStorage(store).profile.save(makeSeller({ email: undefined }));
    renderApp(store);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/setup/?next=%2Fapp%2Finvoice%2F', { replace: true }));
    expect(screen.queryByRole('navigation', { name: 'Invoice tool' })).not.toBeInTheDocument();
  });
});

describe('InvoiceApp with a saved profile', () => {
  it('goes straight to the tool, with the Documents tab selected', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    expect(await screen.findByRole('navigation', { name: 'Invoice tool' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Documents' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('heading', { name: 'Set up your business' })).not.toBeInTheDocument();
  });

  it('warns when the browser is not keeping data between visits', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store, { persistent: false });
    expect(await screen.findByText('Your browser is not saving data')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('normal browser window');
    expect(screen.getByRole('alert')).toHaveTextContent(/Backup & restore tab/);
  });

  it('offers the business details on the setup page, coming back to this tool', async () => {
    const store = createMemoryStore();
    await seedProfile(store);
    renderApp(store);
    expect(await screen.findByRole('link', { name: 'Business details' })).toHaveAttribute('href', '/app/setup/?next=%2Fapp%2Finvoice%2F');
    expect(navigate).not.toHaveBeenCalled();
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

  /** Opens the "+ New" chooser on the list and picks a kind by its card name. */
  async function startNew(name: string) {
    await userEvent.click(await screen.findByRole('button', { name: 'New' }));
    await userEvent.click(within(await screen.findByRole('group', { name: 'Choose a document type' })).getByRole('button', { name }));
  }

  it('shows the documents list first, with three tabs and no tab for creating or for the profile', async () => {
    await openApp();
    const nav = within(screen.getByRole('navigation', { name: 'Invoice tool' }));
    expect(nav.getAllByRole('button').map((button) => button.textContent)).toEqual(['Documents', 'Themes', 'Backup & restore']);
    expect(nav.getByRole('button', { name: 'Documents' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByRole('heading', { name: 'Start your first document' })).toBeInTheDocument();
  });

  it('opens the editor from the empty state, keeps the Documents tab current and goes back', async () => {
    await openApp();
    const cards = within(await screen.findByRole('group', { name: 'Choose a document type to start with' }));
    await userEvent.click(cards.getByRole('button', { name: 'Tax invoice' }));
    expect(await screen.findByRole('heading', { name: 'New tax invoice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Documents', current: 'page' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to documents' }));
    expect(await screen.findByRole('heading', { name: 'Start your first document' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tax invoice' }));
    expect(await screen.findByRole('heading', { name: 'New tax invoice' })).toBeInTheDocument();
  });

  it('leaves a half-typed document for the list with the Documents tab, and starts the next one fresh', async () => {
    await openApp([makeInvoice({ id: 'i1', status: 'issued' })]);
    await startNew('Tax invoice');
    await userEvent.type(await screen.findByLabelText('Client name'), 'Half typed');
    expect(screen.getByLabelText('Client name')).toHaveValue('Half typed');
    await userEvent.click(screen.getByRole('button', { name: 'Documents' }));
    expect(await screen.findByRole('list', { name: 'Documents' })).toBeInTheDocument();
    await startNew('Tax invoice');
    expect(await screen.findByLabelText('Client name')).toHaveValue('');
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
    expect(screen.getByRole('button', { name: 'Documents' })).toHaveAttribute('aria-current', 'page');
  });

  it('issues a quotation, converts it to a draft invoice, and keeps the quotation in the list', async () => {
    const { storage } = await openApp([makeInvoice({ id: 'q1', kind: 'quote', number: 'QT/2026-27/0001', validUntil: '2026-11-13' })]);
    await screen.findByRole('list', { name: 'Documents' });
    await startNew('Quotation');
    expect(await screen.findByRole('heading', { name: 'New quotation' })).toBeInTheDocument();
    expect(screen.getByLabelText('Quotation number')).toHaveValue('QT/2026-27/0002');
    await userEvent.click(screen.getByRole('button', { name: 'Back to documents' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Open QT/2026-27/0001' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Convert to invoice' }));
    expect(await screen.findByRole('heading', { name: 'Edit draft' })).toBeInTheDocument();
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0001');
    expect(screen.getByRole('region', { name: 'Document kind' })).toHaveTextContent('Tax invoice');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    expect((await storage.invoices.list()).find((invoice) => invoice.kind === 'invoice')?.convertedFromId).toBe('q1');
    await userEvent.click(screen.getByRole('button', { name: 'Back to documents' }));
    expect(await screen.findByText('QT/2026-27/0001')).toBeInTheDocument();
    expect(screen.getByText('Converted')).toBeInTheDocument();
  });

  it('shows the viewer after an invoice is issued', async () => {
    await openApp();
    await userEvent.click(await screen.findByRole('button', { name: 'Tax invoice' }));
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

  it('stays in the tool after a restore that brings a complete profile', async () => {
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
    expect((await createInvoiceStorage(store).profile.get())?.name).toBe('Restored Co');
    expect(screen.getByRole('navigation', { name: 'Invoice tool' })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
