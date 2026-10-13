import { renderToBuffer } from '@react-pdf/renderer';
import { PRESET_THEMES, buildInvoiceDocument, type InvoiceRecord } from '@solokit/tool-invoice';
import { makeClient, makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { InvoicePdf } from './InvoicePdf';
import { registerInvoiceFonts } from './fonts';
import { buildQrDataUrl } from './qr';
import { FONT_DIR, extractPdfText } from './testing';

beforeAll(() => registerInvoiceFonts(FONT_DIR));

async function render(invoice: InvoiceRecord = makeInvoice(), themeId = 'classic', qrDataUrl?: string) {
  const theme = PRESET_THEMES.find((candidate) => candidate.id === themeId);
  if (!theme) throw new Error(`Unknown theme ${themeId}`);
  const buffer = await renderToBuffer(
    <InvoicePdf doc={buildInvoiceDocument(invoice)} theme={theme} {...(qrDataUrl ? { qrDataUrl } : {})} />,
  );
  return { buffer, pages: await extractPdfText(buffer) };
}

// Letter-spaced upper-case titles can come back with gaps between letters, so compare without whitespace.
const squash = (text: string) => text.replace(/\s+/g, '').toLowerCase();

describe('InvoicePdf: every layout carries the same invoice', () => {
  for (const theme of PRESET_THEMES) {
    it(`${theme.name} shows the invoice, parties, lines, totals and signature`, async () => {
      const { buffer, pages } = await render(makeInvoice(), theme.id);
      expect(Buffer.from(buffer).subarray(0, 5).toString()).toBe('%PDF-');
      expect(pages).toHaveLength(1);
      const text = pages[0] as string;
      expect(squash(text)).toContain('taxinvoice');
      for (const expected of [
        '2026-27/0001',
        '14 Oct 2026',
        'Asha Rao Consulting',
        'GSTIN: 27AAPFU0939F1ZV',
        'Northwind Traders',
        'Maharashtra',
        'Consulting',
        '998312',
        '24 hrs',
        '₹3,000.00',
        '₹72,000.00',
        'CGST @9%',
        'SGST @9%',
        '₹84,960.00',
        'Eighty-Four Thousand Nine Hundred Sixty Rupees Only',
        'For Asha Rao Consulting',
        'Authorised signatory',
      ]) {
        expect(text, `${theme.id}: ${expected}`).toContain(expected);
      }
    });
  }
});

describe('InvoicePdf: content variations', () => {
  it('shows bank details and the UPI caption, and embeds a QR image when given one', async () => {
    const qr = await buildQrDataUrl('upi://pay?pa=asha@okhdfc&pn=Asha&am=84960.00&cu=INR');
    const withQr = await render(makeInvoice(), 'classic', qr);
    const without = await render(makeInvoice(), 'classic');
    const text = withQr.pages[0] as string;
    for (const expected of ['Account number', '123456789012', 'IFSC', 'HDFC0001234', 'asha@okhdfc']) {
      expect(text, expected).toContain(expected);
    }
    expect(withQr.buffer.length).toBeGreaterThan(without.buffer.length);
  });

  it('shows TDS, the net payable and the TDS declaration', async () => {
    const { pages } = await render(makeInvoice({ tds: { ratePercent: 10 } }), 'modern');
    const text = pages[0] as string;
    expect(text).toContain('TDS @10% (deducted by client)');
    // Inter kerns "7," so pdf.js may split the amount into two text items; compare without whitespace.
    expect(text.replace(/\s+/g, '')).toContain('-₹7,200.00');
    expect(text).toContain('Net payable');
    expect(text.replace(/\s+/g, '')).toContain('₹77,760.00');
    expect(text).toContain('TDS at 10% is expected to be deducted by the client');
  });

  it('leaves out the tax columns for an unregistered seller and says so', async () => {
    const invoice = makeInvoice({
      seller: makeSeller({ gstStatus: 'unregistered', gstin: undefined }),
      placeOfSupplyStateCode: undefined,
      lines: [{ id: 'a', description: 'Logo design', quantity: 1, unit: 'fixed', rate: 500000 }],
    });
    const { pages } = await render(invoice, 'minimal');
    const text = pages[0] as string;
    expect(squash(text)).toContain('invoice');
    expect(squash(text)).not.toContain('taxinvoice');
    expect(text).not.toContain('CGST');
    expect(text).toContain('Not registered under GST.');
    expect(text).toContain('Fixed fee');
    expect(text).toContain('₹5,000.00');
  });

  it('shows an export in dollars with the LUT statement', async () => {
    const invoice = makeInvoice({
      seller: makeSeller({ lutNumber: 'AD270326012345Z' }),
      client: makeClient({ gstin: undefined, address: { line1: '1 Main St', city: 'Austin', country: 'United States' } }),
      currency: 'USD',
      isExport: true,
      placeOfSupplyStateCode: undefined,
      lines: [{ id: 'a', description: 'Consulting', quantity: 1, unit: 'fixed', rate: 123456, gstRate: 18 }],
    });
    const { pages } = await render(invoice, 'bold');
    const text = pages[0] as string;
    expect(text).toContain('$1,234.56');
    expect(text).toContain('LUT No. AD270326012345Z');
    expect(text).toContain('Outside India (export)');
    expect(text).toContain('United States');
  });

  it('stamps DRAFT and CANCELLED on invoices that are not issued', async () => {
    const draft = await render(makeInvoice({ status: 'draft' }), 'classic');
    expect(draft.pages[0]).toContain('DRAFT');
    const cancelled = await render(makeInvoice({ status: 'cancelled' }), 'classic');
    expect(cancelled.pages[0]).toContain('CANCELLED');
    const issued = await render(makeInvoice(), 'classic');
    expect(issued.pages[0]).not.toContain('DRAFT');
    expect(issued.pages[0]).not.toContain('CANCELLED');
  });

  it('titles a proforma invoice', async () => {
    const { pages } = await render(makeInvoice({ kind: 'proforma' }), 'formal');
    expect(squash(pages[0] as string)).toContain('proformainvoice');
  });

  it('shows notes, terms and the due date', async () => {
    const { pages } = await render(makeInvoice({ notes: 'Thank you for your business.', terms: 'Payment within 15 days.', dueDate: '2026-10-29' }), 'consultant');
    const text = pages[0] as string;
    expect(text).toContain('Thank you for your business.');
    expect(text).toContain('Payment within 15 days.');
    expect(text).toContain('29 Oct 2026');
  });

  it('draws a logo from a PNG data URL without failing', async () => {
    const logo = await buildQrDataUrl('logo-stand-in', 64);
    const { pages } = await render(makeInvoice({ seller: makeSeller({ logoDataUrl: logo }) }), 'classic');
    expect(pages[0]).toContain('Asha Rao Consulting');
  });

  it('keeps accented and non-ASCII Latin text from clients and descriptions', async () => {
    const invoice = makeInvoice({
      client: makeClient({ name: 'Łódź Café & Co.' }),
      lines: [{ id: 'a', description: 'Façade design: naïve résumé', quantity: 1, unit: 'fixed', rate: 100000, gstRate: 18 }],
    });
    const { pages } = await render(invoice, 'classic');
    expect(pages[0]).toContain('Łódź Café & Co.');
    expect(pages[0]).toContain('Façade design: naïve résumé');
  });
});

describe('InvoicePdf: long invoices', () => {
  it('flows onto more pages and numbers them', async () => {
    const lines = Array.from({ length: 60 }, (_, index) => ({
      id: `l${index}`,
      description: `Line item ${index + 1}`,
      quantity: 1,
      unit: 'items' as const,
      rate: 100000,
      gstRate: 18,
    }));
    const { pages } = await render(makeInvoice({ lines }), 'classic');
    expect(pages.length).toBeGreaterThan(1);
    const all = pages.join(' ');
    expect(all).toContain('Line item 1 ');
    expect(all).toContain('Line item 60');
    expect(all).toContain('Page 1 of');
    expect(pages[pages.length - 1]).toContain('Authorised signatory');
  });

  it('wraps a very long description instead of cutting it off', async () => {
    const description = `${'Detailed consulting engagement covering discovery workshops and delivery '.repeat(5)}END-MARKER`;
    const { pages } = await render(makeInvoice({ lines: [{ id: 'a', description, quantity: 1, unit: 'fixed', rate: 100000, gstRate: 18 }] }), 'classic');
    expect(pages.join(' ')).toContain('END-MARKER');
  });
});
