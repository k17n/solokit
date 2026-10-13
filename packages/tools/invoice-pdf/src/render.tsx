import { pdf } from '@react-pdf/renderer';
import { buildInvoiceDocument, type InvoiceRecord, type InvoiceTheme } from '@solokit/tool-invoice';
import { registerInvoiceFonts } from './fonts';
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
  registerInvoiceFonts(fontBase);
  const doc = buildInvoiceDocument(invoice);
  const qrDataUrl = doc.payment.upi ? await buildQrDataUrl(doc.payment.upi.payload) : undefined;
  return pdf(<InvoicePdf doc={doc} theme={theme} {...(qrDataUrl ? { qrDataUrl } : {})} />).toBlob();
}

/** "Invoice-2026-27-0001.pdf": the document title and the number, safe for file systems. */
export function pdfFilename(invoice: InvoiceRecord): string {
  const { title, number } = buildInvoiceDocument(invoice);
  const safeTitle = title.replace(/\s+/g, '-');
  const safeNumber = number.replace(/[^A-Za-z0-9-]+/g, '-');
  return `${safeTitle}-${safeNumber}.pdf`;
}
