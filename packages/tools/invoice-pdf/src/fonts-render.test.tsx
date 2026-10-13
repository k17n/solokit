import { Document, Page, Text, renderToBuffer } from '@react-pdf/renderer';
import { FONT_OPTIONS } from '@solokit/tool-invoice';
import { beforeAll, describe, expect, it } from 'vitest';
import { FONT_WEIGHTS, registerInvoiceFonts } from './fonts';
import { FONT_DIR, extractPdfText } from './testing';

beforeAll(() => registerInvoiceFonts(FONT_DIR));

describe('registerInvoiceFonts', () => {
  it('knows the two weights', () => {
    expect([...FONT_WEIGHTS]).toEqual([400, 700]);
  });

  it('can be called more than once with the same base', () => {
    expect(() => {
      registerInvoiceFonts(FONT_DIR);
      registerInvoiceFonts(FONT_DIR);
    }).not.toThrow();
  });

  for (const font of FONT_OPTIONS) {
    it(`puts the rupee sign and other currency symbols into a real PDF using ${font.label}`, async () => {
      const buffer = await renderToBuffer(
        <Document>
          <Page size="A4" style={{ fontFamily: font.id, padding: 40 }}>
            <Text>Total ₹ 1,18,000.00 € 12.50 £ 3 $ 4</Text>
            <Text style={{ fontWeight: 700 }}>Bold ₹ 84,960.00 Łódź café</Text>
          </Page>
        </Document>,
      );
      expect(Buffer.from(buffer).subarray(0, 5).toString()).toBe('%PDF-');
      const [page] = await extractPdfText(buffer);
      expect(page).toContain('Total ₹ 1,18,000.00 € 12.50 £ 3 $ 4');
      expect(page).toContain('Bold ₹ 84,960.00 Łódź café');
    });
  }
});

describe('resetInvoiceFonts', () => {
  it('removes the invoice families but keeps Helvetica, and lets the same base register again', async () => {
    const { Font } = await import('@react-pdf/renderer');
    const { resetInvoiceFonts } = await import('./fonts');
    resetInvoiceFonts();
    const registry = Font.getRegisteredFonts();
    for (const font of FONT_OPTIONS) expect(registry[font.id], font.id).toBeUndefined();
    expect(registry['Helvetica']).toBeDefined();
    registerInvoiceFonts(FONT_DIR);
    for (const font of FONT_OPTIONS) expect(registry[font.id], font.id).toBeDefined();
  });
});
