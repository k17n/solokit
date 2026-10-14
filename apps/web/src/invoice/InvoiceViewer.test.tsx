import { render, screen, waitFor } from '@testing-library/react';
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

async function setup(invoice: ReturnType<typeof makeInvoice> | null, id = 'i1') {
  const storage: InvoiceStorage = createInvoiceStorage(createMemoryStore(), { now: () => new Date(2026, 9, 14, 10, 0) });
  await storage.profile.save(makeSeller());
  if (invoice) await storage.invoices.save(invoice);
  const handlers = { onBack: vi.fn(), onEdit: vi.fn() };
  render(<InvoiceViewer storage={storage} invoiceId={id} {...handlers} renderPdf={fakeRender} />);
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

  it('still opens an invoice that cannot be laid out', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await setup(makeInvoice({ id: 'i1', status: 'issued', lines: [{ ...makeInvoice().lines[0]!, rate: -100 }] }));
    expect(await screen.findByRole('heading', { name: '2026-27/0001' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Duplicate as new draft' })).toBeInTheDocument();
  });

  it('goes back to the list', async () => {
    const { onBack } = await setup(makeInvoice({ id: 'i1', status: 'issued' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Back to invoices' }));
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
    expect(copy).toMatchObject({ status: 'draft', number: '2026-27/0002' });
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
