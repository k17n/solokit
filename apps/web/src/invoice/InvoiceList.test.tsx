import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createInvoiceStorage, type InvoiceStorage } from '@solokit/tool-invoice';
import { makeClient, makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { InvoiceList } from './InvoiceList';
import type { PdfRenderer } from './usePdfPreview';

afterEach(() => vi.restoreAllMocks());

const pdf = new Blob(['pdf'], { type: 'application/pdf' });

async function setup(invoices: ReturnType<typeof makeInvoice>[] = [], renderPdf?: PdfRenderer) {
  const storage: InvoiceStorage = createInvoiceStorage(createMemoryStore(), { now: () => new Date(2026, 9, 14, 10, 0) });
  await storage.profile.save(makeSeller());
  for (const invoice of invoices) await storage.invoices.save(invoice);
  const handlers = { onNew: vi.fn(), onEdit: vi.fn(), onView: vi.fn(), onOpenBackup: vi.fn() };
  render(<InvoiceList storage={storage} {...handlers} renderPdf={renderPdf ?? (async () => pdf)} now={() => new Date(2026, 9, 14, 10, 0)} />);
  return { storage, ...handlers };
}

const issued = makeInvoice({ id: 'i1', number: '2026-27/0001', status: 'issued', issueDate: '2026-10-14' });
const draft = makeInvoice({ id: 'd1', number: '2026-27/0002', status: 'draft', issueDate: '2026-10-15', client: makeClient({ id: 'c2', name: 'Acme Co' }) });
const cancelled = makeInvoice({ id: 'x1', number: '2026-27/0003', status: 'cancelled', issueDate: '2026-10-16' });

describe('InvoiceList: showing invoices', () => {
  it('shows the three kinds as cards, with the usual order, when there are no documents', async () => {
    const { onNew } = await setup();
    expect(await screen.findByRole('heading', { name: 'Start your first document' })).toBeInTheDocument();
    const cards = within(screen.getByRole('group', { name: 'Choose a document type to start with' }));
    expect(cards.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'INVTax invoiceBill a client for work done',
      'QTQuotationSend a price offer before the work. Not a tax document',
      'PFProforma invoiceAsk for payment before you start or ship',
    ]);
    expect(screen.getByText(/Quotation → Invoice/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
    await userEvent.click(cards.getByRole('button', { name: 'Quotation' }));
    expect(onNew).toHaveBeenLastCalledWith('quote');
    await userEvent.click(cards.getByRole('button', { name: 'Proforma invoice' }));
    expect(onNew).toHaveBeenLastCalledWith('proforma');
    await userEvent.click(cards.getByRole('button', { name: 'Tax invoice' }));
    expect(onNew).toHaveBeenLastCalledWith('invoice');
  });

  it('names the ordinary document after the seller', async () => {
    const storage: InvoiceStorage = createInvoiceStorage(createMemoryStore());
    await storage.profile.save(makeSeller({ gstStatus: 'composition' }));
    render(<InvoiceList storage={storage} onNew={vi.fn()} onEdit={vi.fn()} onView={vi.fn()} />);
    expect(await screen.findByRole('button', { name: 'Bill of supply' })).toBeInTheDocument();
  });

  it('lists invoices newest first with number, client, date, status and total', async () => {
    await setup([issued, draft, cancelled]);
    const list = await screen.findByRole('list', { name: 'Documents' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('2026-27/0003');
    expect(items[2]).toHaveTextContent('2026-27/0001');
    expect(items[2]).toHaveTextContent('Northwind Traders');
    expect(items[2]).toHaveTextContent('14 Oct 2026');
    expect(items[2]).toHaveTextContent('Issued');
    expect(items[2]).toHaveTextContent('₹84,960.00');
    expect(items[1]).toHaveTextContent('Draft');
    expect(items[1]).toHaveTextContent('Acme Co');
    expect(items[0]).toHaveTextContent('Cancelled');
  });

  it('shows a dash instead of a total that cannot be worked out', async () => {
    const broken = makeInvoice({ id: 'b1', number: '2026-27/0009', status: 'draft', lines: [{ ...makeInvoice().lines[0]!, rate: -100 }] });
    await setup([broken]);
    const item = (await screen.findAllByRole('listitem'))[0]!;
    expect(item).toHaveTextContent('–');
  });

  it('has one + New control that opens a chooser, and picking a kind starts it', async () => {
    const { onNew } = await setup([issued]);
    const trigger = await screen.findByRole('button', { name: 'New' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'New quotation' })).not.toBeInTheDocument();
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(within(screen.getByRole('group', { name: 'Choose a document type' })).getByRole('button', { name: 'Quotation' }));
    expect(onNew).toHaveBeenCalledWith('quote');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Choose a document type' })).not.toBeInTheDocument();
  });
});

describe('InvoiceList: the New chooser', () => {
  it('moves focus into the cards, walks them with the arrow keys and picks with Enter', async () => {
    const { onNew } = await setup([issued]);
    await userEvent.click(await screen.findByRole('button', { name: 'New' }));
    expect(screen.getByRole('button', { name: 'Tax invoice' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Quotation' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Proforma invoice' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Tax invoice' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'Proforma invoice' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('button', { name: 'Tax invoice' })).toHaveFocus();
    await userEvent.keyboard('{End}{Enter}');
    expect(onNew).toHaveBeenCalledWith('proforma');
  });

  it('describes each card with its use-case line', async () => {
    await setup([issued]);
    await userEvent.click(await screen.findByRole('button', { name: 'New' }));
    expect(screen.getByRole('button', { name: 'Quotation' })).toHaveAccessibleDescription('Send a price offer before the work. Not a tax document');
  });

  it('closes with Escape and gives focus back to the New button', async () => {
    const { onNew } = await setup([issued]);
    const trigger = await screen.findByRole('button', { name: 'New' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Choose a document type' })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    expect(onNew).not.toHaveBeenCalled();
  });

  it('closes when the New button is pressed again or the user clicks elsewhere', async () => {
    await setup([issued]);
    const trigger = await screen.findByRole('button', { name: 'New' });
    await userEvent.click(trigger);
    await userEvent.click(trigger);
    expect(screen.queryByRole('group', { name: 'Choose a document type' })).not.toBeInTheDocument();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('list', { name: 'Documents' }));
    expect(screen.queryByRole('group', { name: 'Choose a document type' })).not.toBeInTheDocument();
  });
});

describe('InvoiceList: opening', () => {
  it('opens drafts in the editor and issued invoices in the viewer', async () => {
    const { onEdit, onView } = await setup([issued, draft]);
    await userEvent.click(await screen.findByRole('button', { name: 'Open 2026-27/0002' }));
    expect(onEdit).toHaveBeenCalledWith('d1');
    await userEvent.click(screen.getByRole('button', { name: 'Open 2026-27/0001' }));
    expect(onView).toHaveBeenCalledWith('i1');
  });
});

describe('InvoiceList: downloading', () => {
  it('builds the PDF on demand and saves it under its file name', async () => {
    const clicks: string[] = [];
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    const renderPdf = vi.fn<PdfRenderer>().mockResolvedValue(pdf);
    await setup([issued], renderPdf);
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF 2026-27/0001' }));
    await waitFor(() => expect(clicks).toEqual(['Tax-Invoice-2026-27-0001.pdf']));
    expect(renderPdf).toHaveBeenCalledOnce();
    expect(renderPdf.mock.calls[0]?.[0].invoice.id).toBe('i1');
    expect(renderPdf.mock.calls[0]?.[0].theme.id).toBe('classic');
  });

  it('still downloads under a plain name when the invoice is incomplete', async () => {
    const clicks: string[] = [];
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    await setup([makeInvoice({ id: 'b1', number: '2026-27/0009', status: 'draft', lines: [{ ...makeInvoice().lines[0]!, rate: -100 }] })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF 2026-27/0009' }));
    await waitFor(() => expect(clicks).toEqual(['invoice.pdf']));
  });

  it('says so when the PDF cannot be built', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await setup([issued], async () => {
      throw new Error('boom');
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF 2026-27/0001' }));
    expect(await screen.findByText('The PDF could not be built. Try again.')).toBeInTheDocument();
  });
});

describe('InvoiceList: duplicating', () => {
  it('copies an invoice into a new draft with the next number and opens it', async () => {
    const { storage, onEdit } = await setup([issued]);
    await userEvent.click(await screen.findByRole('button', { name: 'Duplicate 2026-27/0001' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
    const all = await storage.invoices.list();
    expect(all).toHaveLength(2);
    const copy = all.find((invoice) => invoice.id !== 'i1');
    expect(copy).toMatchObject({ status: 'draft', number: '2026-27/0002', issueDate: '2026-10-14' });
    expect(onEdit).toHaveBeenCalledWith(copy?.id);
  });
});

describe('InvoiceList: cancelling and deleting', () => {
  it('cancels an issued invoice only after a second click, and keeps it in the list', async () => {
    const { storage } = await setup([issued]);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel invoice 2026-27/0001' }));
    expect(screen.getByText('Cancel invoice 2026-27/0001? Its number stays used.')).toBeInTheDocument();
    expect((await storage.invoices.get('i1'))?.status).toBe('issued');
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel invoice' }));
    await waitFor(async () => expect((await storage.invoices.get('i1'))?.status).toBe('cancelled'));
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
  });

  it('moves focus to the question, and back to the button when the user keeps the invoice', async () => {
    await setup([issued]);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel invoice 2026-27/0001' }));
    expect(screen.getByText('Cancel invoice 2026-27/0001? Its number stays used.')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.getByRole('button', { name: 'Cancel invoice 2026-27/0001' })).toHaveFocus();
  });

  it('moves focus to the question when deleting a draft, and back when it is kept', async () => {
    await setup([draft]);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete draft 2026-27/0002' }));
    expect(screen.getByText('Delete draft 2026-27/0002? This cannot be undone.')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.getByRole('button', { name: 'Delete draft 2026-27/0002' })).toHaveFocus();
  });

  it('can back out of cancelling', async () => {
    const { storage } = await setup([issued]);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel invoice 2026-27/0001' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByText(/Its number stays used/)).not.toBeInTheDocument();
    expect((await storage.invoices.get('i1'))?.status).toBe('issued');
  });

  it('offers cancel only for issued invoices and delete only for drafts', async () => {
    await setup([issued, draft, cancelled]);
    await screen.findByRole('list', { name: 'Documents' });
    expect(screen.getByRole('button', { name: 'Cancel invoice 2026-27/0001' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel invoice 2026-27/0002' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel invoice 2026-27/0003' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete draft 2026-27/0002' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete draft 2026-27/0001' })).not.toBeInTheDocument();
  });

  it('deletes a draft after a second click', async () => {
    const { storage } = await setup([draft]);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete draft 2026-27/0002' }));
    expect(screen.getByText('Delete draft 2026-27/0002? This cannot be undone.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete draft' }));
    await waitFor(async () => expect(await storage.invoices.get('d1')).toBeUndefined());
    expect(await screen.findByRole('heading', { name: 'Start your first document' })).toBeInTheDocument();
  });
});

describe('InvoiceList: backup reminder', () => {
  it('reminds you to back up when invoices exist and no backup was ever made, and opens the backup screen', async () => {
    const { onOpenBackup } = await setup([issued]);
    expect(await screen.findByText('Back up your invoices')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back up now' }));
    expect(onOpenBackup).toHaveBeenCalledOnce();
  });

  it('stays quiet after a recent backup', async () => {
    const { storage } = await setup();
    await storage.invoices.save(issued);
    await storage.settings.update({ lastBackupAt: new Date(2026, 9, 10).toISOString() });
    // A fresh render sees the saved time.
    document.body.innerHTML = '';
    const handlers = { onNew: vi.fn(), onEdit: vi.fn(), onView: vi.fn() };
    render(<InvoiceList storage={storage} {...handlers} renderPdf={async () => pdf} now={() => new Date(2026, 9, 14, 10, 0)} />);
    await screen.findByRole('list', { name: 'Documents' });
    expect(screen.queryByText('Back up your invoices')).not.toBeInTheDocument();
  });

  it('says the backup is old when the last one was over 30 days ago', async () => {
    const { storage } = await setup();
    await storage.invoices.save(issued);
    await storage.settings.update({ lastBackupAt: new Date(2026, 7, 1).toISOString() });
    document.body.innerHTML = '';
    render(<InvoiceList storage={storage} onNew={vi.fn()} onEdit={vi.fn()} onView={vi.fn()} renderPdf={async () => pdf} now={() => new Date(2026, 9, 14, 10, 0)} />);
    expect(await screen.findByText(/since your last backup/)).toBeInTheDocument();
  });

  it('does not nag when there are no invoices', async () => {
    await setup();
    await screen.findByRole('heading', { name: 'Start your first document' });
    expect(screen.queryByText('Back up your invoices')).not.toBeInTheDocument();
  });
});

describe('InvoiceList: quotations and proformas', () => {
  const quote = makeInvoice({ id: 'q1', kind: 'quote', number: 'QT/2026-27/0001', validUntil: '2026-11-13', issueDate: '2026-10-14' });
  const proforma = makeInvoice({ id: 'p1', kind: 'proforma', number: 'PF/2026-27/0001', issueDate: '2026-10-13' });
  const converted = makeInvoice({ id: 'q2', kind: 'quote', number: 'QT/2026-27/0002', validUntil: '2026-11-13', issueDate: '2026-10-12', convertedToId: 'x' });
  const row = (number: string) => screen.getAllByRole('listitem').find((item) => within(item).queryByText(number, { exact: true }))!;

  it('shows a badge for each kind, and Converted on a converted quotation', async () => {
    await setup([issued, quote, proforma, converted]);
    await screen.findByRole('list', { name: 'Documents' });
    expect(row('2026-27/0001')).toHaveTextContent('Invoice');
    expect(row('QT/2026-27/0001')).toHaveTextContent('Quotation');
    expect(row('QT/2026-27/0001')).not.toHaveTextContent('Converted');
    expect(row('PF/2026-27/0001')).toHaveTextContent('Proforma');
    expect(row('QT/2026-27/0002')).toHaveTextContent('Converted');
  });

  it('filters by kind with a segmented control that shows how many of each there are', async () => {
    await setup([issued, quote, proforma, converted]);
    await screen.findByRole('list', { name: 'Documents' });
    const filters = within(screen.getByRole('group', { name: 'Filter by type' }));
    expect(filters.getAllByRole('button').map((button) => button.textContent)).toEqual(['All4', 'Invoices1', 'Quotations2', 'Proformas1']);
    const visible = () => within(screen.getByRole('list', { name: 'Documents' })).getAllByRole('listitem').map((item) => item.textContent ?? '');
    expect(visible()).toHaveLength(4);
    expect(filters.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(filters.getByRole('button', { name: /^Quotations/ }));
    expect(filters.getByRole('button', { name: /^Quotations/ })).toHaveAttribute('aria-pressed', 'true');
    expect(filters.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'false');
    expect(visible()).toHaveLength(2);
    await userEvent.click(filters.getByRole('button', { name: /^Proformas/ }));
    expect(visible()).toHaveLength(1);
    expect(visible()[0]).toContain('PF/2026-27/0001');
    await userEvent.click(filters.getByRole('button', { name: /^Invoices/ }));
    expect(visible()).toHaveLength(1);
    expect(visible()[0]).toContain('2026-27/0001');
    await userEvent.click(filters.getByRole('button', { name: /^All/ }));
    expect(visible()).toHaveLength(4);
  });

  it('counts a legacy record without a kind as an invoice', async () => {
    const legacy = makeInvoice({ id: 'l1', number: '2026-27/0008', status: 'issued' });
    delete (legacy as { kind?: string }).kind;
    await setup([legacy, quote]);
    await screen.findByRole('list', { name: 'Documents' });
    const filters = within(screen.getByRole('group', { name: 'Filter by type' }));
    expect(filters.getByRole('button', { name: /^Invoices/ })).toHaveTextContent('1');
    expect(filters.getByRole('button', { name: /^Quotations/ })).toHaveTextContent('1');
  });

  it('says so when a filter matches nothing', async () => {
    await setup([issued]);
    await screen.findByRole('list', { name: 'Documents' });
    const filters = within(screen.getByRole('group', { name: 'Filter by type' }));
    expect(filters.getByRole('button', { name: /^Quotations/ })).toHaveTextContent('0');
    await userEvent.click(filters.getByRole('button', { name: /^Quotations/ }));
    expect(screen.getByText('No quotations yet.')).toBeInTheDocument();
  });

  it('puts the main action by kind first: Download PDF for an issued invoice, Convert for an issued quotation, Open for a draft', async () => {
    await setup([issued, quote, draft]);
    await screen.findByRole('list', { name: 'Documents' });
    const firstAction = (number: string) => within(row(number)).getAllByRole('button')[0]!;
    expect(firstAction('2026-27/0001')).toHaveAccessibleName('Download PDF 2026-27/0001');
    expect(firstAction('QT/2026-27/0001')).toHaveAccessibleName('Convert to invoice QT/2026-27/0001');
    expect(firstAction('2026-27/0002')).toHaveAccessibleName('Open 2026-27/0002');
    expect(within(row('2026-27/0001')).getAllByRole('button', { name: /Download PDF/ })).toHaveLength(1);
  });

  it('says "Convert to tax invoice" on an issued proforma from a regular seller', async () => {
    await setup([proforma]);
    expect(await screen.findByRole('button', { name: 'Convert to tax invoice PF/2026-27/0001' })).toBeInTheDocument();
  });

  it('converts an issued quotation into a draft invoice and opens it', async () => {
    const { storage, onEdit } = await setup([quote]);
    await userEvent.click(await screen.findByRole('button', { name: 'Convert to invoice QT/2026-27/0001' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
    const draftInvoice = await storage.invoices.get(onEdit.mock.calls[0]![0]);
    expect(draftInvoice).toMatchObject({ kind: 'invoice', status: 'draft', convertedFromId: 'q1', number: '2026-27/0001' });
    expect((await storage.invoices.get('q1'))?.convertedToId).toBe(draftInvoice?.id);
  });

  it('shows a converted quotation as Invoiced with a link to its invoice instead of Convert', async () => {
    const target = makeInvoice({ id: 'inv9', number: '2026-27/0009', status: 'issued', convertedFromId: 'q2' });
    const { onView } = await setup([target, { ...converted, convertedToId: 'inv9' }]);
    await screen.findByRole('list', { name: 'Documents' });
    expect(within(row('QT/2026-27/0002')).queryByRole('button', { name: /^Convert/ })).not.toBeInTheDocument();
    const link = within(row('QT/2026-27/0002')).getByRole('button', { name: 'Open invoice 2026-27/0009' });
    expect(link).toHaveTextContent('Invoiced → 2026-27/0009');
    await userEvent.click(link);
    expect(onView).toHaveBeenCalledWith('inv9');
  });

  it('marks every row with its kind', async () => {
    await setup([issued, quote, proforma]);
    await screen.findByRole('list', { name: 'Documents' });
    expect(row('2026-27/0001')).toHaveAttribute('data-kind', 'invoice');
    expect(row('QT/2026-27/0001')).toHaveAttribute('data-kind', 'quote');
    expect(row('PF/2026-27/0001')).toHaveAttribute('data-kind', 'proforma');
  });

  it('cancels a quotation under its own name, keeping its number', async () => {
    const { storage } = await setup([quote]);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel quotation QT/2026-27/0001' }));
    expect(screen.getByText('Cancel quotation QT/2026-27/0001? Its number stays used.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel quotation' }));
    await waitFor(async () => expect((await storage.invoices.get('q1'))?.status).toBe('cancelled'));
  });

  it('duplicates a quotation into the next quotation number, not a tax invoice number', async () => {
    const { storage, onEdit } = await setup([issued, quote]);
    await userEvent.click(await screen.findByRole('button', { name: 'Duplicate QT/2026-27/0001' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
    expect(await storage.invoices.get(onEdit.mock.calls[0]![0])).toMatchObject({ kind: 'quote', number: 'QT/2026-27/0002', status: 'draft', validUntil: '2026-11-13' });
  });
});
