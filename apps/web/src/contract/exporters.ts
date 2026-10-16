import type { Contract } from '@solokit/tool-contract';
import type { InvoiceTheme } from '@solokit/tool-invoice';

export type ExportKind = 'pdf' | 'docx' | 'review-pdf' | 'review-docx';

export interface ExportInput {
  contract: Contract;
  theme: InvoiceTheme;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
}

/** Builds one of the four downloads. The real one loads the PDF and Word engines only when it is first used. */
export type ContractExporter = (kind: ExportKind, input: ExportInput) => Promise<ExportResult>;

export const EXPORT_LABEL: Record<ExportKind, string> = {
  pdf: 'Download PDF',
  docx: 'Download Word',
  'review-pdf': 'Download review pack',
  'review-docx': 'Download review pack (Word)',
};

export const defaultExporter: ContractExporter = async (kind, { contract, theme }) => {
  const exported = await import('@solokit/tool-contract-export');
  const part = kind === 'review-pdf' || kind === 'review-docx' ? 'review-pack' : 'agreement';
  const extension = kind === 'pdf' || kind === 'review-pdf' ? 'pdf' : 'docx';
  const filename = exported.contractFilename(contract, part, extension);
  const options = { theme, showTemplateNotice: true };
  switch (kind) {
    case 'pdf':
      return { blob: await exported.renderContractPdf({ contract, theme, fontBase: '/fonts/invoice' }), filename };
    case 'review-pdf':
      return { blob: await exported.renderReviewPackPdf({ contract, theme, fontBase: '/fonts/invoice' }), filename };
    case 'docx':
      return { blob: await exported.renderContractDocx(contract, options), filename };
    case 'review-docx':
      return { blob: await exported.renderReviewPackDocx(contract, options), filename };
  }
};

export function describeExportError(error: unknown): string {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(text)) {
    return 'The document tools could not be loaded. Check your connection and try again.';
  }
  return 'The document could not be built. Try again.';
}
