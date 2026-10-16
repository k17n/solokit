import { PRESET_THEMES } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { describe, expect, it } from 'vitest';
import { renderInvoicePdf } from './render';
import { FONT_DIR, extractPdfText } from './testing';

const quote = (overrides = {}) =>
  makeInvoice({ kind: 'quote', number: 'QT/2026-27/0001', validUntil: '2026-11-13', tds: { ratePercent: 10 }, advanceReceived: 1000, ...overrides });

async function textOf(invoice: ReturnType<typeof makeInvoice>, themeId: string): Promise<string> {
  const theme = PRESET_THEMES.find((candidate) => candidate.id === themeId)!;
  const blob = await renderInvoicePdf({ invoice, theme, fontBase: FONT_DIR });
  return (await extractPdfText(new Uint8Array(await blob.arrayBuffer()))).join('\n');
}

const squash = (text: string) => text.replace(/\s+/g, '');

describe('a quotation PDF', () => {
  it.each(PRESET_THEMES.map((theme) => theme.id))('says Quotation and Valid until, never Tax Invoice, in the %s layout', async (themeId) => {
    const text = await textOf(quote(), themeId);
    expect(text.toLowerCase()).toContain('quotation');
    expect(squash(text)).toContain('Validuntil13Nov2026');
    expect(squash(text)).toContain('Thisisanestimate,notataxinvoice.');
    expect(squash(text)).not.toContain('TaxInvoice');
    expect(text).not.toContain('Due');
    expect(text).not.toContain('Net payable');
    expect(text).not.toContain('Scan to pay');
    expect(squash(text)).toContain('Estimatedtotal');
    expect(squash(text)).toContain('(estimated)');
  });

  it('prints no tax-invoice wording for an unregistered seller either', async () => {
    const text = await textOf(quote({ seller: makeSeller({ gstStatus: 'unregistered', gstin: undefined }), placeOfSupplyStateCode: undefined }), 'classic');
    expect(text.toLowerCase()).toContain('quotation');
    expect(squash(text)).not.toContain('TaxInvoice');
    expect(squash(text)).not.toContain('NotregisteredunderGST');
  });

  it('is not marked as a tax invoice when drafted or cancelled, and says Quotation in the footer', async () => {
    const text = await textOf(quote({ status: 'draft' }), 'classic');
    expect(text).toContain('DRAFT');
    expect(squash(text)).not.toContain('TaxInvoice');
    expect(squash(text)).toContain('QuotationQT/2026-27/0001');
  });

  it('leaves an invoice unchanged: still a Tax Invoice with no validity line', async () => {
    const text = await textOf(makeInvoice(), 'classic');
    expect(squash(text)).toContain('TaxInvoice');
    expect(squash(text)).not.toContain('Validuntil');
  });
});
