import { PRESET_THEMES } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { describe, expect, it } from 'vitest';
import { pdfFilename, renderInvoicePdf } from './render';
import { FONT_DIR, extractPdfText } from './testing';

const theme = (id: string) => {
  const found = PRESET_THEMES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Unknown theme ${id}`);
  return found;
};

describe('renderInvoicePdf', () => {
  it('returns a PDF blob for an invoice and a theme', async () => {
    const blob = await renderInvoicePdf({ invoice: makeInvoice(), theme: theme('modern'), fontBase: FONT_DIR });
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(2000);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-');
    const [page] = await extractPdfText(bytes);
    expect(page).toContain('₹84,960.00');
    expect(page).toContain('asha@okhdfc');
  });

  it('draws the UPI QR code for INR invoices that have a UPI id and an amount to pay', async () => {
    const withUpi = await renderInvoicePdf({ invoice: makeInvoice(), theme: theme('classic'), fontBase: FONT_DIR });
    const withoutUpi = await renderInvoicePdf({
      invoice: makeInvoice({ seller: makeSeller({ upiId: undefined }) }),
      theme: theme('classic'),
      fontBase: FONT_DIR,
    });
    expect(withUpi.size).toBeGreaterThan(withoutUpi.size);
  });

  it('renders every preset', async () => {
    for (const preset of PRESET_THEMES) {
      const blob = await renderInvoicePdf({ invoice: makeInvoice(), theme: preset, fontBase: FONT_DIR });
      expect(blob.size, preset.id).toBeGreaterThan(2000);
    }
  });

  it('keeps a small invoice well under 150 KB', async () => {
    const blob = await renderInvoicePdf({ invoice: makeInvoice(), theme: theme('classic'), fontBase: FONT_DIR });
    expect(blob.size).toBeLessThan(150 * 1024);
  });

  it('works with every bundled font', async () => {
    for (const fontId of ['inter', 'poppins', 'source-serif-4', 'inconsolata', 'geist-mono'] as const) {
      const blob = await renderInvoicePdf({
        invoice: makeInvoice(),
        theme: { ...theme('classic'), fontId },
        fontBase: FONT_DIR,
      });
      const [page] = await extractPdfText(new Uint8Array(await blob.arrayBuffer()));
      expect(page, fontId).toContain('₹84,960.00');
    }
  });
});

describe('pdfFilename', () => {
  it('turns the invoice number into a safe file name', () => {
    expect(pdfFilename(makeInvoice())).toBe('Tax-Invoice-2026-27-0001.pdf');
    expect(pdfFilename(makeInvoice({ number: 'INV/2026-27/0012' }))).toBe('Tax-Invoice-INV-2026-27-0012.pdf');
  });

  it('names bills of supply and proforma invoices accordingly', () => {
    expect(pdfFilename(makeInvoice({ seller: makeSeller({ gstStatus: 'composition' }) }))).toBe('Bill-of-Supply-2026-27-0001.pdf');
    expect(pdfFilename(makeInvoice({ kind: 'proforma' }))).toBe('Proforma-Invoice-2026-27-0001.pdf');
  });

  it('names an unregistered seller\'s plain invoice "Invoice"', () => {
    expect(pdfFilename(makeInvoice({ seller: makeSeller({ gstStatus: 'unregistered', gstin: undefined }), placeOfSupplyStateCode: undefined }))).toBe(
      'Invoice-2026-27-0001.pdf',
    );
  });
});
