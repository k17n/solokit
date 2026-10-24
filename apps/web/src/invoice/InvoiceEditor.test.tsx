import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createInvoiceStorage, type InvoiceStorage, type InvoiceTheme } from '@solokit/tool-invoice';
import { type BusinessProfile } from '@solokit/profile';
import { makeClient, makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { InvoiceEditor } from './InvoiceEditor';
import { documentName } from './kinds';
import type { PdfRenderer } from './usePdfPreview';

beforeEach(() => {
  let counter = 0;
  Object.assign(URL, { createObjectURL: vi.fn(() => `blob:fake-${++counter}`), revokeObjectURL: vi.fn() });
});

const fakeRender: PdfRenderer = async () => new Blob(['pdf'], { type: 'application/pdf' });

const NOW = () => new Date(2026, 9, 14, 10, 0);

async function setup(
  options: {
    profile?: BusinessProfile;
    invoiceId?: string;
    clients?: boolean;
    abroadClient?: boolean;
    withInvoices?: ReturnType<typeof makeInvoice>[];
    wrap?: (storage: InvoiceStorage) => InvoiceStorage;
    themes?: InvoiceTheme[];
    defaultThemeId?: string;
    renderPdf?: PdfRenderer;
    initialKind?: 'invoice' | 'proforma' | 'quote';
  } = {},
) {
  const real: InvoiceStorage = createInvoiceStorage(createMemoryStore(), { now: NOW });
  const storage = options.wrap ? options.wrap(real) : real;
  const profile = options.profile ?? makeSeller();
  await storage.profile.save(profile);
  if (options.clients) await storage.clients.save(makeClient({ id: 'c1', name: 'Northwind Traders' }));
  if (options.abroadClient) {
    await storage.clients.save(
      makeClient({ id: 'c2', name: 'Acme Inc', gstin: undefined, address: { line1: '1 Main St', city: 'Austin', stateCode: '27', country: 'United States' } }),
    );
  }
  for (const invoice of options.withInvoices ?? []) await storage.invoices.save(invoice);
  for (const theme of options.themes ?? []) await storage.themes.save(theme);
  if (options.defaultThemeId) await storage.settings.update({ defaultThemeId: options.defaultThemeId });
  const onBack = vi.fn();
  const onIssued = vi.fn();
  render(
    <InvoiceEditor storage={storage} profile={profile} invoiceId={options.invoiceId} initialKind={options.initialKind} onBack={onBack} onIssued={onIssued} renderPdf={options.renderPdf ?? fakeRender} now={NOW} />,
  );
  await screen.findByRole('heading', { name: options.invoiceId ? 'Edit draft' : options.initialKind === 'quote' ? 'New quotation' : options.initialKind === 'proforma' ? 'New proforma invoice' : `New ${documentName('invoice', profile.gstStatus).toLowerCase()}` });
  return { storage, onBack, onIssued, profile };
}

/** Opens "Change type" and picks a kind by the name on its card. */
async function changeType(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Change type' }));
  await userEvent.click(within(screen.getByRole('group', { name: 'Change document type' })).getByRole('button', { name }));
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
    const { storage } = await setup();
    const nextNumber = vi.spyOn(storage.invoices, 'nextNumber');
    const date = screen.getByLabelText('Issue date');
    await userEvent.clear(date);
    await userEvent.type(date, '2027-04-02');
    await waitFor(() => expect(screen.getByLabelText('Invoice number')).toHaveValue('2027-28/0001'));
    await userEvent.clear(screen.getByLabelText('Invoice number'));
    await userEvent.type(screen.getByLabelText('Invoice number'), 'MINE-1');
    await userEvent.clear(date);
    const askedBefore = nextNumber.mock.calls.length;
    await userEvent.type(date, '2026-05-01');
    // A number typed by hand is not worked out again: the editor does not even ask for one.
    expect(nextNumber.mock.calls.length).toBe(askedBefore);
    expect(screen.getByLabelText('Invoice number')).toHaveValue('MINE-1');
  });

  it('does not renumber when the date moves within the same financial year', async () => {
    const { storage } = await setup();
    await storage.invoices.save(makeInvoice({ id: 'late', number: '2026-27/0002' }));
    const nextNumber = vi.spyOn(storage.invoices, 'nextNumber');
    const date = screen.getByLabelText('Issue date');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-11-20');
    // Same financial year: the editor does not ask for a new number at all.
    expect(nextNumber).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0001');
  });

  it('keeps the number of a saved new draft when its date moves into another financial year', async () => {
    const { storage } = await setup();
    await fillClient();
    await fillFirstItem();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    const nextNumber = vi.spyOn(storage.invoices, 'nextNumber');
    const date = screen.getByLabelText('Issue date');
    await userEvent.clear(date);
    await userEvent.type(date, '2027-04-02');
    expect(nextNumber).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0001');
  });

  it('cannot be saved or issued while the new number is still being looked up', async () => {
    let release: (() => void) | undefined;
    let calls = 0;
    const { storage } = await setup({
      wrap: (real) => ({
        ...real,
        invoices: {
          ...real.invoices,
          nextNumber: async (date: string) => {
            calls += 1;
            if (calls === 1) return real.invoices.nextNumber(date);
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            return real.invoices.nextNumber(date);
          },
        },
      }),
    });
    const date = screen.getByLabelText('Issue date');
    await userEvent.clear(date);
    await userEvent.type(date, '2027-04-02');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Issue invoice' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await act(async () => {
      release?.();
    });
    await waitFor(() => expect(screen.getByLabelText('Invoice number')).toHaveValue('2027-28/0001'));
    expect(screen.getByRole('button', { name: 'Issue invoice' })).toBeEnabled();
    expect(await storage.invoices.list()).toEqual([]);
  });

  it('uses the injected clock, not the real date', async () => {
    await setup();
    expect(screen.getByLabelText('Issue date')).toHaveValue('2026-10-14');
  });
});

describe('InvoiceEditor: clients and exports', () => {
  it('ticks the export box when a client outside India is chosen, and fills the country', async () => {
    await setup({ abroadClient: true });
    await userEvent.selectOptions(screen.getByLabelText('Client'), 'c2');
    expect(screen.getByRole('checkbox', { name: 'Client is outside India (export)' })).toBeChecked();
    expect(screen.getByLabelText('Country')).toHaveValue('United States');
    expect(screen.queryByLabelText('Place of supply')).not.toBeInTheDocument();
  });

  it('unticks the export box when a domestic client is chosen', async () => {
    await setup({ clients: true, abroadClient: true });
    await userEvent.selectOptions(screen.getByLabelText('Client'), 'c2');
    await userEvent.selectOptions(screen.getByLabelText('Client'), 'c1');
    expect(screen.getByRole('checkbox', { name: 'Client is outside India (export)' })).not.toBeChecked();
    expect(screen.getByLabelText('Place of supply')).toHaveValue('27');
  });

  it('saves a chosen client as it was typed, not as the export switch shapes it', async () => {
    const { storage } = await setup({ abroadClient: true });
    await userEvent.selectOptions(screen.getByLabelText('Client'), 'c2');
    await fillFirstItem('100', '1', 'Rate ($)');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    const saved = (await storage.clients.list()).find((client) => client.id === 'c2');
    expect(saved?.address).toMatchObject({ country: 'United States', stateCode: '27' });
  });

  it('clears the country when export is ticked while it still says India', async () => {
    await setup();
    expect(screen.getByRole('checkbox', { name: 'Client is outside India (export)' })).not.toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Client is outside India (export)' }));
    expect(screen.getByLabelText('Country')).toHaveValue('');
  });

  it('refuses to issue an export to a client in India', async () => {
    const { onIssued } = await setup();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Client is outside India (export)' }));
    await userEvent.type(screen.getByLabelText('Client name'), 'Acme Inc');
    await userEvent.type(screen.getByLabelText('Address line 1'), '1 Main St');
    await userEvent.type(screen.getByLabelText('City'), 'Austin');
    await userEvent.type(screen.getByLabelText('Country'), 'India');
    await fillFirstItem('100', '1', 'Rate ($)');
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    expect((await screen.findAllByText("Enter the client's country outside India")).length).toBeGreaterThan(0);
    expect(onIssued).not.toHaveBeenCalled();
  });

  it('describes the LUT honestly and warns when the profile has no LUT number', async () => {
    await setup();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Client is outside India (export)' }));
    expect(screen.getByText(/If you have a Letter of Undertaking \(LUT\)/)).toBeInTheDocument();
    expect(screen.getByText(/Your profile has no LUT number/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'business details' })).toHaveAttribute('href', '/app/setup/?next=%2Fapp%2Finvoice%2F&step=defaults');
  });

  it('does not warn about the LUT when the profile has one', async () => {
    await setup({ profile: makeSeller({ lutNumber: 'AD270326000001A' }) });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Client is outside India (export)' }));
    expect(screen.queryByText(/Your profile has no LUT number/)).not.toBeInTheDocument();
  });

  it('empties an auto-filled place of supply when "New client" is chosen again', async () => {
    await setup({ clients: true });
    await userEvent.selectOptions(screen.getByLabelText('Client'), 'c1');
    expect(screen.getByLabelText('Place of supply')).toHaveValue('27');
    await userEvent.selectOptions(screen.getByLabelText('Client'), '');
    expect(screen.getByLabelText('Place of supply')).toHaveValue('');
  });
});

describe('InvoiceEditor: problems the form cannot show', () => {
  it('flags a number from another financial year', async () => {
    await setup();
    await userEvent.clear(screen.getByLabelText('Invoice number'));
    await userEvent.type(screen.getByLabelText('Invoice number'), '2025-26/0007');
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    expect((await screen.findAllByText('This number belongs to financial year 2025-26 but the date is in 2026-27')).length).toBeGreaterThan(0);
  });

  it('lists profile problems as such and moves focus to the summary', async () => {
    await setup({ profile: makeSeller({ udyam: 'bogus' }) });
    await fillClient();
    await fillFirstItem();
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    expect(await screen.findByText(/^Profile: UDYAM number looks like/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'business details' })).toHaveAttribute('href', '/app/setup/?next=%2Fapp%2Finvoice%2F&step=details');
    await waitFor(() => expect(screen.getByText(/Fix 1 thing before you issue/).closest('[tabindex="-1"]')).toHaveFocus());
  });

  it('offers a visible empty choice for the GST rate', async () => {
    await setup();
    const rate = within(screen.getByRole('group', { name: 'Item 1' })).getByLabelText('GST rate');
    await userEvent.selectOptions(rate, 'Choose a rate');
    expect(rate).toHaveValue('');
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

  it('shows "Back to documents" and calls onBack', async () => {
    const { onBack } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Back to documents' }));
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
    render(<InvoiceEditor storage={storage} profile={makeSeller()} invoiceId="i1" onBack={() => {}} onIssued={() => {}} renderPdf={fakeRender} now={NOW} />);
    expect(await screen.findByText('This invoice cannot be edited')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to documents' })).toBeInTheDocument();
  });
});

describe('InvoiceEditor: themes', () => {
  const mine: InvoiceTheme = { id: 'mine', name: 'Rust', layout: 'modern', accent: '#7C2D12', text: '#14213D', background: '#FFFFFF', fontId: 'poppins' };

  it('starts a new invoice with the default theme from the settings', async () => {
    const { storage } = await setup({ defaultThemeId: 'bold' });
    expect(screen.getByLabelText('Invoice theme')).toHaveValue('bold');
    await fillClient();
    await fillFirstItem();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(async () => expect((await storage.invoices.list())[0]?.themeId).toBe('bold'));
  });

  it('offers my themes, saves the choice on the invoice and previews with it', async () => {
    const renderPdf = vi.fn(fakeRender);
    const { storage } = await setup({ themes: [mine], renderPdf });
    await userEvent.selectOptions(screen.getByLabelText('Invoice theme'), 'mine');
    await fillClient();
    await fillFirstItem();
    await userEvent.click(screen.getByRole('button', { name: 'Show preview' }));
    await waitFor(() => expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({ theme: expect.objectContaining({ id: 'mine', accent: '#7C2D12' }) })), { timeout: 4000 });
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(async () => expect((await storage.invoices.list())[0]?.themeId).toBe('mine'));
  }, 20000);

  it('keeps a copy of the theme on the invoice when it is issued', async () => {
    const { storage } = await setup({ themes: [mine] });
    await userEvent.selectOptions(screen.getByLabelText('Invoice theme'), 'mine');
    await fillClient();
    await fillFirstItem();
    await userEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));
    await waitFor(async () => expect((await storage.invoices.list())[0]?.status).toBe('issued'));
    expect((await storage.invoices.list())[0]?.themeSnapshot).toEqual(mine);
  }, 20000);

  it('falls back to Classic when the default theme no longer exists', async () => {
    await setup({ defaultThemeId: 'deleted-one' });
    expect(screen.getByLabelText('Invoice theme')).toHaveValue('classic');
  });

  it('shows the default theme for a draft whose theme was deleted', async () => {
    await setup({ invoiceId: 'd', defaultThemeId: 'modern', withInvoices: [makeInvoice({ id: 'd', status: 'draft', themeId: 'gone' })] });
    expect(screen.getByLabelText('Invoice theme')).toHaveValue('modern');
  });
});

describe('InvoiceEditor: quotations and number series', () => {
  it('starts a quotation in its own series with a validity date', async () => {
    await setup({ initialKind: 'quote', withInvoices: [makeInvoice({ id: 'a', number: '2026-27/0007' })] });
    expect(screen.getByLabelText('Quotation number')).toHaveValue('QT/2026-27/0001');
    expect(screen.getByLabelText('Valid until')).toHaveValue('2026-11-13');
    expect(screen.getByRole('button', { name: 'Issue quotation' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Due date')).not.toBeInTheDocument();
  });

  it('renumbers into the other series when the document type changes, until the number is typed', async () => {
    await setup({
      withInvoices: [
        makeInvoice({ id: 'a', number: '2026-27/0007' }),
        makeInvoice({ id: 'q', kind: 'quote', number: 'QT/2026-27/0003', validUntil: '2026-11-13' }),
      ],
    });
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0008');
    await changeType('Quotation');
    await waitFor(() => expect(screen.getByLabelText('Quotation number')).toHaveValue('QT/2026-27/0004'));
    await changeType('Proforma invoice');
    await waitFor(() => expect(screen.getByLabelText('Proforma number')).toHaveValue('PF/2026-27/0001'));
    await changeType('Tax invoice');
    await waitFor(() => expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0008'));
    await userEvent.clear(screen.getByLabelText('Invoice number'));
    await userEvent.type(screen.getByLabelText('Invoice number'), 'MINE-1');
    await changeType('Quotation');
    await waitFor(() => expect(screen.getByLabelText('Quotation number')).toHaveValue('QT/2026-27/0004'));
  });

  it('renumbers a hand-typed number that does not fit the new type, and says so', async () => {
    await setup();
    await userEvent.clear(screen.getByLabelText('Invoice number'));
    await userEvent.type(screen.getByLabelText('Invoice number'), 'MINE-1');
    await changeType('Quotation');
    await waitFor(() => expect(screen.getByLabelText('Quotation number')).toHaveValue('QT/2026-27/0001'));
    expect(screen.getByText(/number MINE-1 was replaced/i)).toBeInTheDocument();
    // The new number is generated, so it follows the date again.
    const date = screen.getByLabelText('Issue date');
    await userEvent.clear(date);
    await userEvent.type(date, '2027-04-02');
    await waitFor(() => expect(screen.getByLabelText('Quotation number')).toHaveValue('QT/2027-28/0001'));
  });

  it('keeps a hand-typed number that already fits the new type', async () => {
    const { storage } = await setup();
    const nextNumber = vi.spyOn(storage.invoices, 'nextNumber');
    await changeType('Quotation');
    await waitFor(() => expect(screen.getByLabelText('Quotation number')).toHaveValue('QT/2026-27/0001'));
    await userEvent.clear(screen.getByLabelText('Quotation number'));
    await userEvent.type(screen.getByLabelText('Quotation number'), 'QT/2026-27/0099');
    await changeType('Proforma invoice');
    await waitFor(() => expect(screen.getByLabelText('Proforma number')).toHaveValue('PF/2026-27/0001'));
    const askedBefore = nextNumber.mock.calls.length;
    await userEvent.clear(screen.getByLabelText('Proforma number'));
    await userEvent.type(screen.getByLabelText('Proforma number'), 'PF/2026-27/0050');
    expect(nextNumber.mock.calls.length).toBe(askedBefore);
    expect(screen.getByLabelText('Proforma number')).toHaveValue('PF/2026-27/0050');
    expect(screen.queryByText(/was replaced/i)).not.toBeInTheDocument();
  });

  it('renumbers a quotation by financial year inside the quotation series', async () => {
    await setup({ initialKind: 'quote' });
    const date = screen.getByLabelText('Issue date');
    await userEvent.clear(date);
    await userEvent.type(date, '2027-04-02');
    await waitFor(() => expect(screen.getByLabelText('Quotation number')).toHaveValue('QT/2027-28/0001'));
  });

  it('does not hand out the number printed on an old proforma that holds a tax-series number', async () => {
    await setup({ withInvoices: [makeInvoice({ id: 'old', kind: 'proforma', number: '2026-27/0001' })] });
    expect(screen.getByLabelText('Invoice number')).toHaveValue('2026-27/0002');
  });

  it('issues a quotation without a due date and does not use a tax invoice number', async () => {
    const { storage, onIssued } = await setup({ initialKind: 'quote' });
    await fillClient();
    await fillFirstItem();
    await userEvent.click(screen.getByRole('button', { name: 'Issue quotation' }));
    await waitFor(() => expect(onIssued).toHaveBeenCalledOnce());
    const [saved] = await storage.invoices.list();
    expect(saved).toMatchObject({ kind: 'quote', status: 'issued', number: 'QT/2026-27/0001', validUntil: '2026-11-13' });
    expect(await storage.invoices.nextNumber('2026-10-14')).toBe('2026-27/0001');
  });

  it('asks for a valid-until date that is not before the issue date', async () => {
    await setup({ initialKind: 'quote' });
    await fillClient();
    await fillFirstItem();
    const until = screen.getByLabelText('Valid until');
    await userEvent.clear(until);
    await userEvent.type(until, '2026-10-01');
    await userEvent.click(screen.getByRole('button', { name: 'Issue quotation' }));
    expect((await screen.findAllByText('The "valid until" date cannot be before the issue date')).length).toBeGreaterThan(0);
  });

  it('locks the document type once the draft is saved', async () => {
    await setup({ initialKind: 'quote' });
    await fillClient();
    await fillFirstItem();
    expect(screen.getByRole('button', { name: 'Change type' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    expect(screen.queryByRole('button', { name: 'Change type' })).not.toBeInTheDocument();
    expect(screen.getByText(/The type is fixed once a draft is saved/)).toBeInTheDocument();
  });

  it('shows the chosen kind as a badge with what it is for, and no type select', async () => {
    await setup({ initialKind: 'proforma' });
    const banner = screen.getByRole('region', { name: 'Document kind' });
    expect(within(banner).getByText('Proforma invoice')).toBeInTheDocument();
    expect(within(banner).getByText('Ask for payment before you start or ship')).toBeInTheDocument();
    expect(screen.queryByLabelText('Document type')).not.toBeInTheDocument();
  });

  it('names the tax invoice after the seller', async () => {
    await setup({ profile: makeSeller({ gstStatus: 'composition' }) });
    expect(screen.getByRole('heading', { name: 'New bill of supply' })).toBeInTheDocument();
  });

  it('keeps what was typed when the type changes, and the chooser closes with Escape back on its button', async () => {
    await setup();
    await fillClient();
    await userEvent.click(screen.getByRole('button', { name: 'Change type' }));
    expect(screen.getByRole('button', { name: 'Tax invoice' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Change document type' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change type' })).toHaveFocus();
    await changeType('Quotation');
    expect(screen.getByRole('heading', { name: 'New quotation' })).toBeInTheDocument();
    expect(screen.getByLabelText('Client name')).toHaveValue('Northwind Traders');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change type' })).toHaveFocus());
  });
});
