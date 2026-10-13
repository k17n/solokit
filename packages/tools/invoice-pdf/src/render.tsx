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

/** "Invoice-2026-27-0001.pdf": the document title and the number, safe for file systems. */
export function pdfFilename(invoice: InvoiceRecord): string {
  const { title, number } = buildInvoiceDocument(invoice);
  const safeTitle = title.replace(/\s+/g, '-');
  const safeNumber = number.replace(/[^A-Za-z0-9-]+/g, '-');
  return `${safeTitle}-${safeNumber}.pdf`;
}
