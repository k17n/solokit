import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createInvoiceStorage, type InvoiceStorage, type SellerProfile } from '@solokit/tool-invoice';
import { makeClient, makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { InvoiceEditor } from './InvoiceEditor';
import type { PdfRenderer } from './usePdfPreview';

beforeEach(() => {
  let counter = 0;
  Object.assign(URL, { createObjectURL: vi.fn(() => `blob:fake-${++counter}`), revokeObjectURL: vi.fn() });
});

const fakeRender: PdfRenderer = async () => new Blob(['pdf'], { type: 'application/pdf' });

async function setup(options: { profile?: SellerProfile; invoiceId?: string; clients?: boolean; withInvoices?: ReturnType<typeof makeInvoice>[] } = {}) {
  const storage: InvoiceStorage = createInvoiceStorage(createMemoryStore(), { now: () => new Date(2026, 9, 14, 10, 0) });
  const profile = options.profile ?? makeSeller();
  await storage.profile.save(profile);
  if (options.clients) await storage.clients.save(makeClient({ id: 'c1', name: 'Northwind Traders' }));
  for (const invoice of options.withInvoices ?? []) await storage.invoices.save(invoice);
  const onBack = vi.fn();
  const onIssued = vi.fn();
  render(
    <InvoiceEditor storage={storage} profile={profile} invoiceId={options.invoiceId} onBack={onBack} onIssued={onIssued} renderPdf={fakeRender} />,
  );
  await screen.findByRole('heading', { name: options.invoiceId ? 'Edit draft' : 'New invoice' });
  return { storage, onBack, onIssued, profile };
}

async function fillClient() {
  await userEvent.type(screen.getByLabelText('Client name'), 'Northwind Traders');
  await userEvent.type(screen.getByLabelText('Address line 1'), '4 MG Road');
  await userEvent.type(screen.getByLabelText('City'), 'Pune');
  await userEvent.selectOptions(screen.getByLabelText('State'), '27');
}

async function fillFirstItem(rate = '3000', quantity = '24', rateLabel = 'Rate (₹)') {
  const item = within(screen.getByRole('group', { name: 'Item 1' }));
  await userEvent.type(item.getByLabelText('Description'), 'Consulting');
  await userEvent.clear(item.getByLabelText('Quantity'));
  await userEvent.type(item.getByLabelText('Quantity'), quantity);
  await userEvent.type(item.getByLabelText(rateLabel), rate);
}

describe('InvoiceEditor: opening', () => {
  it('starts a new invoice with the next number and today\'s date', async () => {
    await setup();
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0001');
    expect(screen.getByLabelText('Issue date')).toHaveValue('2026-10-14');
  });

  it('continues the numbering after existing invoices', async () => {
    await setup({ withInvoices: [makeInvoice({ id: 'a', number: '2026-27/0007' })] });
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0008');
  });

  it('offers saved clients and fills the form from one, including the place of supply', async () => {
    await setup({ clients: true });
    await userEvent.selectOptions(screen.getByLabelText('Client'), 'c1');
    expect(screen.getByLabelText('Client name')).toHaveValue('Northwind Traders');
    expect(screen.getByLabelText('Place of supply')).toHaveValue('27');
  });

  it('shows GST fields only for a regular seller', async () => {
    await setup();
    expect(screen.getByLabelText('Place of supply')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Item 1' })).getByLabelText('GST rate')).toBeInTheDocument();
  });

  it('hides the GST fields for an unregistered seller', async () => {
    await setup({ profile: makeSeller({ gstStatus: 'unregistered', gstin: undefined }) });
    expect(screen.queryByLabelText('Place of supply')).not.toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Item 1' })).queryByLabelText('GST rate')).not.toBeInTheDocument();
  });

  it('renumbers when the issue date moves into a new financial year, until the number is typed by hand', async () => {
    await setup();
    const date = screen.getByLabelText('Issue date');
    await userEvent.clear(date);
    await userEvent.type(date, '2027-04-02');
    await waitFor(() => expect(screen.getByLabelText('Invoice number')).toHaveValue('2027-28/0001'));
    await userEvent.clear(screen.getByLabelText('Invoice number'));
    await userEvent.type(screen.getByLabelText('Invoice number'), 'MINE-1');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-05-01');
    expect(screen.getByLabelText('Invoice number')).toHaveValue('MINE-1');
  });
});

describe('InvoiceEditor: totals and preview', () => {
  it('shows live totals once the invoice is complete', async () => {
    await setup();
    expect(screen.getByText('Fill in the details above to see the totals.')).toBeInTheDocument();
    await fillClient();
    await fillFirstItem();
    const list = await screen.findByRole('list', { name: 'Totals' });
    expect(within(list).getByText('₹84,960.00')).toBeInTheDocument();
    expect(screen.getByText('Eighty-Four Thousand Nine Hundred Sixty Rupees Only')).toBeInTheDocument();
  });

  it('shows the preview only after it is switched on, and only for a valid invoice', async () => {
    await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Show preview' }));
    expect(screen.getByText('Fill in the details to see the preview.')).toBeInTheDocument();
    await fillClient();
    await fillFirstItem();
    expect(await screen.findByTitle('Invoice preview', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('download', 'Tax-Invoice-2026-27-0001.pdf');
    await userEvent.click(screen.getByRole('button', { name: 'Hide preview' }));
    expect(screen.queryByTitle('Invoice preview')).not.toBeInTheDocument();
  }, 20000);
});

describe('InvoiceEditor: saving a draft', () => {
  it('saves a draft and the client, and says so', async () => {
    const { storage } = await setup();
    await fillClient();
    await fillFirstItem();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
    const [saved] = await storage.invoices.list();
    expect(saved).toMatchObject({ status: 'draft', number: '2026-27/0001', client: { name: 'Northwind Traders' } });
    expect((await storage.clients.list()).map((client) => client.name)).toEqual(['Northwind Traders']);
  });

  it('does not save the client when the box is unticked', async () => {
    const { storage } = await setup();
    await fillClient();
    await fillFirstItem();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Save this client for next time' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    expect(await storage.clients.list()).toEqual([]);
  });

  it('can save an incomplete draft, but not one with unreadable numbers', async () => {
    const { storage } = await setup();
    const item = within(screen.getByRole('group', { name: 'Item 1' }));
    await userEvent.type(item.getByLabelText('Rate (₹)'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await storage.invoices.list()).toEqual([]);
    expect(item.getByLabelText('Rate (₹)')).toHaveAttribute('aria-invalid', 'true');
    await userEvent.clear(item.getByLabelText('Rate (₹)'));
    await userEvent.type(item.getByLabelText('Rate (₹)'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Draft saved')).toBeInTheDocument();
    expect((await storage.invoices.list())).toHaveLength(1);
  });

  it('reports a number that is already used', async () => {
    const taken = makeInvoice({ id: 'other', number: 'FIXED-1' });
    await setup({ withInvoices: [taken] });
    await userEvent.clear(screen.getByLabelText('Invoice number'));
    await userEvent.type(screen.getByLabelText('Invoice number'), 'FIXED-1');
    await fillFirstItem();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('That invoice number is already used. Choose another.')).toBeInTheDocument();
    expect(screen.getByLabelText('Invoice number')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows "Back to invoices" and calls onBack', async () => {
    const { onBack } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Back to invoices' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('InvoiceEditor: issuing', () => {
  it('issues a complete invoice, saves it and reports its id', async () => {
    const { storage, onIssued } = await setup();
    await fillClient();
    await fillFirstItem();
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    await waitFor(() => expect(onIssued).toHaveBeenCalledOnce());
    const [saved] = await storage.invoices.list();
    expect(saved).toMatchObject({ id: onIssued.mock.calls[0]?.[0], status: 'issued', number: '2026-27/0001' });
    expect((await storage.clients.list()).map((client) => client.name)).toEqual(['Northwind Traders']);
  });

  it('lists what is missing instead of issuing an incomplete invoice, and focuses the first problem', async () => {
    const { storage, onIssued } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    expect(await screen.findByText(/Fix \d+ things before you issue this invoice/)).toBeInTheDocument();
    expect(onIssued).not.toHaveBeenCalled();
    expect(await storage.invoices.list()).toEqual([]);
    await waitFor(() => expect(screen.getByLabelText('Client name')).toHaveFocus());
    expect(screen.getByLabelText('Client name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps the errors up to date as the user fixes things', async () => {
    await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    await screen.findByText(/Fix \d+ things before you issue this invoice/);
    await userEvent.type(screen.getByLabelText('Client name'), 'Northwind');
    expect(screen.getByLabelText('Client name')).not.toHaveAttribute('aria-invalid');
  });

  it('issues an unregistered seller\'s invoice without any GST details', async () => {
    const { storage, onIssued } = await setup({ profile: makeSeller({ gstStatus: 'unregistered', gstin: undefined }) });
    await userEvent.type(screen.getByLabelText('Client name'), 'Local Client');
    await userEvent.type(screen.getByLabelText('Address line 1'), '1 Main Road');
    await userEvent.type(screen.getByLabelText('City'), 'Pune');
    await fillFirstItem('5000', '1');
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    await waitFor(() => expect(onIssued).toHaveBeenCalledOnce());
    const [saved] = await storage.invoices.list();
    expect(saved?.lines[0]?.gstRate).toBeUndefined();
  });

  it('issues an export in dollars', async () => {
    const { storage, onIssued } = await setup();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Client is outside India (export)' }));
    await userEvent.type(screen.getByLabelText('Client name'), 'Acme Inc');
    await userEvent.type(screen.getByLabelText('Address line 1'), '1 Main St');
    await userEvent.type(screen.getByLabelText('City'), 'Austin');
    await userEvent.clear(screen.getByLabelText('Country'));
    await userEvent.type(screen.getByLabelText('Country'), 'United States');
    await fillFirstItem('1234.56', '1', 'Rate ($)');
    expect(within(screen.getByRole('group', { name: 'Item 1' })).getByLabelText('Rate ($)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    await waitFor(() => expect(onIssued).toHaveBeenCalledOnce());
    const [saved] = await storage.invoices.list();
    expect(saved).toMatchObject({ currency: 'USD', isExport: true });
    expect(saved?.lines[0]?.rate).toBe(123456);
  });
});

describe('InvoiceEditor: editing a draft', () => {
  it('opens a saved draft with its values and keeps its number', async () => {
    const draft = makeInvoice({ id: 'd1', number: '2026-27/0005', status: 'draft', notes: 'Hello' });
    const { storage } = await setup({ invoiceId: 'd1', withInvoices: [draft] });
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0005');
    expect(screen.getByLabelText('Client name')).toHaveValue('Northwind Traders');
    expect(screen.getByLabelText('Notes')).toHaveValue('Hello');
    await userEvent.type(screen.getByLabelText('Notes'), ' world');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    expect((await storage.invoices.get('d1'))?.notes).toBe('Hello world');
    expect((await storage.invoices.list())).toHaveLength(1);
  });

  it('refuses to edit an issued invoice', async () => {
    const issued = makeInvoice({ id: 'i1', status: 'issued' });
    const storage = createInvoiceStorage(createMemoryStore());
    await storage.profile.save(makeSeller());
    await storage.invoices.save(issued);
    render(<InvoiceEditor storage={storage} profile={makeSeller()} invoiceId="i1" onBack={() => {}} onIssued={() => {}} renderPdf={fakeRender} />);
    expect(await screen.findByText('This invoice cannot be edited')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to invoices' })).toBeInTheDocument();
  });
});
