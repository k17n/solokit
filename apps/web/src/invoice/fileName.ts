import { buildInvoiceDocument, type InvoiceRecord } from '@solokit/tool-invoice';

/** "Tax-Invoice-2026-27-0001.pdf". Mirrors `pdfFilename` in the PDF package without loading it. */
export function invoiceFileName(invoice: InvoiceRecord): string {
  const { title, number } = buildInvoiceDocument(invoice);
  const safeNumber = number.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'invoice';
  return `${title.replace(/\s+/g, '-')}-${safeNumber}.pdf`;
}
