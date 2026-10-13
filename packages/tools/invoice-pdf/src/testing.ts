import { fileURLToPath } from 'node:url';

/** Where the generated invoice fonts live (served by the web app at /fonts/invoice). */
export const FONT_DIR = fileURLToPath(new URL('../../../../apps/web/public/fonts/invoice', import.meta.url));

/** The text on every page of a PDF, with whitespace collapsed. */
export async function extractPdfText(data: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // pdf.js takes ownership of the buffer it is given, so hand it a copy.
  const document = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    pages.push(text.replace(/\s+/g, ' ').trim());
  }
  return pages;
}

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

/** Every text item on the first page of a PDF, with its position and width in points. */
export async function extractPdfItems(data: Uint8Array): Promise<PdfTextItem[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const page = await document.getPage(1);
  const content = await page.getTextContent();
  const items: PdfTextItem[] = [];
  for (const item of content.items) {
    if ('str' in item) items.push({ str: item.str, x: item.transform[4] as number, y: item.transform[5] as number, width: item.width });
  }
  return items;
}
