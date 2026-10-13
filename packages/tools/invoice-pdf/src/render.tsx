import { pdf } from '@react-pdf/renderer';
import { buildInvoiceDocument, type InvoiceRecord, type InvoiceTheme } from '@solokit/tool-invoice';
import { registerInvoiceFonts, resetInvoiceFonts } from './fonts';
import { InvoicePdf } from './InvoicePdf';
import { buildQrDataUrl } from './qr';

export interface RenderInvoiceInput {
  invoice: InvoiceRecord;
  theme: InvoiceTheme;
  /** Where the invoice fonts are served from: "/fonts/invoice" in the browser. */
  fontBase: string;
}

/** Builds the PDF for an invoice. Throws if the invoice is not valid enough to build (validate first). */
export async function renderInvoicePdf({ invoice, theme, fontBase }: RenderInvoiceInput): Promise<Blob> {
  try {
    registerInvoiceFonts(fontBase);
    const doc = buildInvoiceDocument(invoice);
    const qrDataUrl = doc.payment.upi ? await buildQrDataUrl(doc.payment.upi.payload) : undefined;
    return await pdf(<InvoicePdf doc={doc} theme={theme} {...(qrDataUrl ? { qrDataUrl } : {})} />).toBlob();
  } catch (error) {
    // A failed font download stays cached inside react-pdf; forget the fonts so the next render starts clean.
    resetInvoiceFonts();
    throw error;
  }
}

/** "Tax-Invoice-2026-27-0001.pdf": the document type and the number, safe for file systems. Never runs the tax engine. */
export function pdfFilename(invoice: InvoiceRecord): string {
  const title =
    invoice.kind === 'proforma'
      ? 'Proforma-Invoice'
      : invoice.seller.gstStatus === 'regular'
        ? invoice.exemptSupply
          ? 'Bill-of-Supply'
          : 'Tax-Invoice'
        : invoice.seller.gstStatus === 'composition'
          ? 'Bill-of-Supply'
          : 'Invoice';
  const number = invoice.number.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'invoice';
  return `${title}-${number}.pdf`;
}
