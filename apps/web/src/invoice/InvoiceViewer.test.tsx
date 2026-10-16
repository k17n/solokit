import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createInvoiceStorage, type InvoiceStorage } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { InvoiceViewer } from './InvoiceViewer';
import type { PdfRenderer } from './usePdfPreview';

beforeEach(() => {
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:view'), revokeObjectURL: vi.fn() });
});

const fakeRender: PdfRenderer = async () => new Blob(['pdf'], { type: 'application/pdf' });

async function setup(invoice: ReturnType<typeof makeInvoice> | null, id = 'i1', renderPdf: PdfRenderer = fakeRender) {
  const storage: InvoiceStorage = createInvoiceStorage(createMemoryStore(), { now: () => new Date(2026, 9, 14, 10, 0) });
  await storage.profile.save(makeSeller());
  if (invoice) await storage.invoices.save(invoice);
  const handlers = { onBack: vi.fn(), onEdit: vi.fn() };
  render(<InvoiceViewer storage={storage} invoiceId={id} {...handlers} renderPdf={renderPdf} now={() => new Date(2026, 9, 14, 10, 0)} />);
  return { storage, ...handlers };
}

describe('InvoiceViewer', () => {
  it('shows an issued invoice with its preview, download link and actions', async () => {
    await setup(makeInvoice({ id: 'i1', status: 'issued' }));
    expect(await screen.findByRole('heading', { name: '2026-27/0001' })).toBeInTheDocument();
    expect(screen.getByText('Issued')).toBeInTheDocument();
    expect(screen.getByText(/Northwind Traders/)).toBeInTheDocument();
    expect(await screen.findByTitle('Invoice preview', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('download', 'Tax-Invoice-2026-27-0001.pdf');
    expect(screen.getByRole('button', { name: 'Duplicate as new draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel invoice' })).toBeInTheDocument();
  });

  it('prints with the theme the invoice was issued with, even if that theme was changed since', async () => {
    const renderPdf = vi.fn(fakeRender);
    const issuedWith = { id: 'mine', name: 'Mine', layout: 'modern' as const, accent: '#047857', text: '#14213D', background: '#FFFFFF', fontId: 'inter' as const };
    const storage: InvoiceStorage = createInvoiceStorage(createMemoryStore());
    await storage.themes.save({ ...issuedWith, accent: '#7C2D12' });
    await storage.invoices.save(makeInvoice({ id: 'i1', themeId: 'mine', themeSnapshot: issuedWith }));
    render(<InvoiceViewer storage={storage} invoiceId="i1" onBack={vi.fn()} onEdit={vi.fn()} renderPdf={renderPdf} now={() => new Date(2026, 9, 14, 10, 0)} />);
    await waitFor(() => expect(renderPdf).toHaveBeenCalled(), { timeout: 4000 });
    expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({ theme: expect.objectContaining({ accent: '#047857' }) }));
  });

  it('still opens an invoice that cannot be laid out', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await setup(makeInvoice({ id: 'i1', status: 'issued', lines: [{ ...makeInvoice().lines[0]!, rate: -100 }] }));
    expect(await screen.findByRole('heading', { name: '2026-27/0001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate as new draft' })).toBeInTheDocument();
  });

  it('goes back to the list', async () => {
    const { onBack } = await setup(makeInvoice({ id: 'i1', status: 'issued' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Back to documents' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('cancels an invoice after a second click and then offers no more cancelling', async () => {
    const { storage } = await setup(makeInvoice({ id: 'i1', status: 'issued' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel invoice' }));
    expect(screen.getByText('Cancel this invoice? Its number stays used.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel invoice' }));
    await waitFor(async () => expect((await storage.invoices.get('i1'))?.status).toBe('cancelled'));
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel invoice' })).not.toBeInTheDocument();
  });

  it('duplicates into a new draft and opens it', async () => {
    const { storage, onEdit } = await setup(makeInvoice({ id: 'i1', status: 'issued' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Duplicate as new draft' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
    const copy = (await storage.invoices.list()).find((invoice) => invoice.id !== 'i1');
    expect(copy).toMatchObject({ status: 'draft', number: '2026-27/0002', issueDate: '2026-10-14' });
  });

  it('moves focus to the question when cancelling, and back to the button when kept', async () => {
    await setup(makeInvoice({ id: 'i1', status: 'issued' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel invoice' }));
    expect(screen.getByText('Cancel this invoice? Its number stays used.')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.getByRole('button', { name: 'Cancel invoice' })).toHaveFocus();
  });

  it('lets the user go back from a draft', async () => {
    const { onBack } = await setup(makeInvoice({ id: 'd1', status: 'draft' }), 'd1');
    await userEvent.click(await screen.findByRole('button', { name: 'Back to documents' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('sends a draft to the editor instead of showing it', async () => {
    const { onEdit } = await setup(makeInvoice({ id: 'd1', status: 'draft' }), 'd1');
    expect(await screen.findByText('This invoice is a draft')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Edit draft' }));
    expect(onEdit).toHaveBeenCalledWith('d1');
  });

  it('says so when the invoice does not exist', async () => {
    await setup(null, 'missing');
    expect(await screen.findByText('That invoice was not found')).toBeInTheDocument();
  });
});

describe('InvoiceViewer: quotations and conversion', () => {
  const quote = (overrides = {}) => makeInvoice({ id: 'q1', kind: 'quote', number: 'QT/2026-27/0001', validUntil: '2026-11-13', ...overrides });

  it('shows an issued quotation with its validity and a Convert to invoice button', async () => {
    await setup(quote(), 'q1');
    expect(await screen.findByRole('heading', { name: 'QT/2026-27/0001' })).toBeInTheDocument();
    expect(screen.getByText('Quotation')).toBeInTheDocument();
    expect(screen.getByText(/Valid until 13 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Convert to invoice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel quotation' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Download PDF' }, { timeout: 4000 })).toHaveAttribute('download', 'Quotation-QT-2026-27-0001.pdf');
  });

  it('converts to a new draft tax invoice and opens it, leaving the quotation issued and read-only', async () => {
    const { storage, onEdit } = await setup(quote(), 'q1');
    await storage.invoices.save(makeInvoice({ id: 'old', number: '2026-27/0004' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Convert to invoice' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
    const draft = await storage.invoices.get(onEdit.mock.calls[0]![0]);
    expect(draft).toMatchObject({ kind: 'invoice', status: 'draft', number: '2026-27/0005', convertedFromId: 'q1', issueDate: '2026-10-14' });
    expect(await storage.invoices.get('q1')).toMatchObject({ status: 'issued', convertedToId: draft!.id, number: 'QT/2026-27/0001' });
    expect(await storage.invoices.nextNumber('2026-10-14', 'quote')).toBe('QT/2026-27/0002');
  });

  it('offers the same conversion on an issued proforma', async () => {
    await setup(makeInvoice({ id: 'p1', kind: 'proforma', number: 'PF/2026-27/0001' }), 'p1');
    expect(await screen.findByRole('button', { name: 'Convert to tax invoice' })).toBeInTheDocument();
    expect(screen.getByText('Proforma')).toBeInTheDocument();
  });

  it('puts a context banner on a proforma: not a tax invoice, with the convert button inside it', async () => {
    await setup(makeInvoice({ id: 'p1', kind: 'proforma', number: 'PF/2026-27/0001' }), 'p1');
    const banner = await screen.findByRole('region', { name: 'About this proforma invoice' });
    expect(banner).toHaveAttribute('data-kind', 'proforma');
    expect(within(banner).getByText('Not a tax invoice')).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Convert to tax invoice' })).toBeInTheDocument();
  });

  it('puts the validity and the convert button of a quotation in its banner', async () => {
    await setup(quote(), 'q1');
    const banner = await screen.findByRole('region', { name: 'About this quotation' });
    expect(banner).toHaveAttribute('data-kind', 'quote');
    expect(within(banner).getByText('Valid until 13 Nov 2026')).toBeInTheDocument();
    expect(within(banner).getByText(/not a tax document/)).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Convert to invoice' })).toBeInTheDocument();
  });

  it('has no banner on a plain invoice', async () => {
    await setup(makeInvoice({ id: 'i1' }), 'i1');
    await screen.findByRole('heading', { name: '2026-27/0001' });
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('shows an already converted quotation as converted, links to the draft and offers no second conversion', async () => {
    const onEdit = vi.fn();
    const storage: InvoiceStorage = createInvoiceStorage(createMemoryStore());
    await storage.invoices.save(quote({ convertedToId: 'd1' }));
    await storage.invoices.save(makeInvoice({ id: 'd1', number: '2026-27/0001', status: 'draft', convertedFromId: 'q1' }));
    render(<InvoiceViewer storage={storage} invoiceId="q1" onBack={vi.fn()} onEdit={onEdit} renderPdf={fakeRender} />);
    expect(await screen.findByText(/Converted to draft invoice 2026-27\/0001/)).toBeInTheDocument();
    expect(screen.getByText('Converted', { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Convert to invoice' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open 2026-27/0001' }));
    expect(onEdit).toHaveBeenCalledWith('d1');
  });

  it('does not offer it on a cancelled quotation or a plain invoice', async () => {
    await setup(quote({ status: 'cancelled' }), 'q1');
    await screen.findByRole('heading', { name: 'QT/2026-27/0001' });
    expect(screen.queryByRole('button', { name: 'Convert to invoice' })).not.toBeInTheDocument();
  });

  it('does not offer it on an invoice', async () => {
    await setup(makeInvoice({ id: 'i1' }));
    await screen.findByRole('heading', { name: '2026-27/0001' });
    expect(screen.queryByRole('button', { name: 'Convert to invoice' })).not.toBeInTheDocument();
  });

  it('says which quotation an invoice was made from and opens it', async () => {
    const onView = vi.fn();
    const storage: InvoiceStorage = createInvoiceStorage(createMemoryStore());
    await storage.invoices.save(quote({ convertedToId: 'i1' }));
    await storage.invoices.save(makeInvoice({ id: 'i1', number: '2026-27/0001', convertedFromId: 'q1' }));
    render(<InvoiceViewer storage={storage} invoiceId="i1" onBack={vi.fn()} onEdit={vi.fn()} onView={onView} renderPdf={fakeRender} />);
    expect(await screen.findByText(/Made from quotation QT\/2026-27\/0001/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open QT/2026-27/0001' }));
    expect(onView).toHaveBeenCalledWith('q1');
  });

  it('tells the user a proforma advance was carried over to the draft', async () => {
    const { storage, onEdit } = await setup(makeInvoice({ id: 'p1', kind: 'proforma', number: 'PF/2026-27/0001', advanceReceived: 50000 }), 'p1');
    await userEvent.click(await screen.findByRole('button', { name: 'Convert to tax invoice' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
    expect((await storage.invoices.get(onEdit.mock.calls[0]![0]))?.advanceReceived).toBe(50000);
    expect(await screen.findByText(/advance received on this proforma was carried over/)).toBeInTheDocument();
  });

  it('does not mention an advance for a quotation', async () => {
    const { onEdit } = await setup(quote(), 'q1');
    await userEvent.click(await screen.findByRole('button', { name: 'Convert to invoice' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce());
    expect(screen.queryByText(/carried over/)).not.toBeInTheDocument();
  });

  it('explains that a converted quotation keeps its number when the invoice was cancelled', async () => {
    const storage: InvoiceStorage = createInvoiceStorage(createMemoryStore());
    await storage.invoices.save(quote({ convertedToId: 'i1' }));
    await storage.invoices.save(makeInvoice({ id: 'i1', number: '2026-27/0001', status: 'cancelled', convertedFromId: 'q1' }));
    render(<InvoiceViewer storage={storage} invoiceId="q1" onBack={vi.fn()} onEdit={vi.fn()} renderPdf={fakeRender} />);
    expect(await screen.findByText(/Invoice 2026-27\/0001 was cancelled.*stays used.*duplicate this quotation/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Convert to invoice' })).not.toBeInTheDocument();
  });

  it('shows a plain message when conversion fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { storage } = await setup(quote(), 'q1');
    await storage.invoices.convert('q1', { id: 'other', issueDate: '2026-10-14' });
    await userEvent.click(await screen.findByRole('button', { name: 'Convert to invoice' }));
    expect(await screen.findByText('This document has already been converted to an invoice')).toBeInTheDocument();
  });
});
