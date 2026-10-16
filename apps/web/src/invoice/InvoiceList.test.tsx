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
  const handlers = { onNew: vi.fn(), onEdit: vi.fn(), onView: vi.fn() };
  render(<InvoiceList storage={storage} {...handlers} renderPdf={renderPdf ?? (async () => pdf)} now={() => new Date(2026, 9, 14, 10, 0)} />);
  return { storage, ...handlers };
}

const issued = makeInvoice({ id: 'i1', number: '2026-27/0001', status: 'issued', issueDate: '2026-10-14' });
const draft = makeInvoice({ id: 'd1', number: '2026-27/0002', status: 'draft', issueDate: '2026-10-15', client: makeClient({ id: 'c2', name: 'Acme Co' }) });
const cancelled = makeInvoice({ id: 'x1', number: '2026-27/0003', status: 'cancelled', issueDate: '2026-10-16' });

describe('InvoiceList: showing invoices', () => {
  it('invites the user to create the first invoice when there are none', async () => {
    const { onNew } = await setup();
    expect(await screen.findByText('No invoices yet.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create your first invoice' }));
    expect(onNew).toHaveBeenCalledOnce();
  });

  it('lists invoices newest first with number, client, date, status and total', async () => {
    await setup([issued, draft, cancelled]);
    const list = await screen.findByRole('list', { name: 'Invoices' });
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

  it('has a New invoice button', async () => {
    const { onNew } = await setup([issued]);
    await userEvent.click(await screen.findByRole('button', { name: 'New invoice' }));
    expect(onNew).toHaveBeenCalledOnce();
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
    await screen.findByRole('list', { name: 'Invoices' });
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
    expect(await screen.findByText('No invoices yet.')).toBeInTheDocument();
  });
});
