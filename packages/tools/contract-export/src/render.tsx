import { pdf } from '@react-pdf/renderer';
import { KIND_LABELS, buildReviewPack, resolveContractDocument, type Contract } from '@solokit/tool-contract';
import type { InvoiceTheme } from '@solokit/tool-invoice';
import { registerInvoiceFonts, resetInvoiceFonts } from '@solokit/tool-invoice-pdf';
import { ContractPdf } from './ContractPdf';

export interface RenderContractInput {
  contract: Contract;
  theme: InvoiceTheme;
  /** Where the invoice fonts are served from: "/fonts/invoice" in the browser. */
  fontBase: string;
  /** Print the "prepared from a template, not legal advice" line in the footer. Default true. */
  showTemplateNotice?: boolean;
}

async function render(input: RenderContractInput, withReview: boolean): Promise<Blob> {
  try {
    registerInvoiceFonts(input.fontBase);
    const { document, summary } = withReview
      ? buildReviewPack(input.contract)
      : { document: resolveContractDocument(input.contract), summary: undefined };
    return await pdf(
      <ContractPdf document={document} theme={input.theme} {...(summary ? { summary } : {})} {...(input.showTemplateNotice === undefined ? {} : { showTemplateNotice: input.showTemplateNotice })} />,
    ).toBlob();
  } catch (error) {
    // A failed font download stays cached inside react-pdf; forget the fonts so the next render starts clean.
    resetInvoiceFonts();
    throw error;
  }
}

/** The agreement as a PDF. Throws {@link ContractRenderError} if the agreement is incomplete (run validateContract first). */
export function renderContractPdf(input: RenderContractInput): Promise<Blob> {
  return render(input, false);
}

/** The Review pack: the agreement followed by the review summary, as one PDF. */
export function renderReviewPackPdf(input: RenderContractInput): Promise<Blob> {
  return render(input, true);
}

export type ExportPart = 'agreement' | 'review-pack';

/** "NDA-with-Acme.pdf" or "NDA-with-Acme-Review-Pack.docx": the contract's own title, safe for file systems. */
export function contractFilename(contract: Pick<Contract, 'title' | 'kind'>, part: ExportPart, extension: 'pdf' | 'docx'): string {
  const base =
    (contract.title.trim() || KIND_LABELS[contract.kind])
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '') || 'Agreement';
  return `${base}${part === 'review-pack' ? '-Review-Pack' : ''}.${extension}`;
}
