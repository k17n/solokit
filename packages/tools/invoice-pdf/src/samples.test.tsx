import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRESET_THEMES } from '@solokit/tool-invoice';
import { makeClient, makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { describe, it } from 'vitest';
import { renderInvoicePdf } from './render';
import { FONT_DIR } from './testing';

// Writes sample PDFs for a human to look at. Skipped unless SAMPLES_DIR is set, for example:
//   SAMPLES_DIR=/tmp/solokit-samples pnpm --filter @solokit/tool-invoice-pdf test -- samples
const directory = process.env.SAMPLES_DIR;

type Overrides = Parameters<typeof makeInvoice>[0];

describe.skipIf(!directory)('sample PDFs', () => {
  it('writes one sample per layout and a few special cases', async () => {
    const out = directory as string;
    mkdirSync(out, { recursive: true });
    const lines = Array.from({ length: 40 }, (_, index) => ({
      id: `l${index}`,
      description: `Consulting session ${index + 1}`,
      code: '998312',
      quantity: 1.5,
      unit: 'hours' as const,
      rate: 250000,
      gstRate: 18,
      ...(index === 2 ? { discount: { kind: 'percent' as const, percent: 10 } } : {}),
    }));
    const cases: [string, Overrides, string][] = [
      ...PRESET_THEMES.map((theme): [string, Overrides, string] => [`layout-${theme.id}`, { tds: { ratePercent: 10 }, notes: 'Thank you for your business.', terms: 'Payment within 15 days.', dueDate: '2026-10-29' }, theme.id]),
      ['unregistered', { seller: makeSeller({ gstStatus: 'unregistered', gstin: undefined }), placeOfSupplyStateCode: undefined, lines: [{ id: 'a', description: 'Logo design', quantity: 1, unit: 'fixed', rate: 500000 }] }, 'minimal'],
      ['export-usd', { seller: makeSeller({ lutNumber: 'AD270326012345Z' }), client: makeClient({ gstin: undefined, address: { line1: '1 Main St', city: 'Austin', country: 'United States' } }), currency: 'USD', isExport: true, placeOfSupplyStateCode: undefined, lines: [{ id: 'a', description: 'Consulting', quantity: 1, unit: 'fixed', rate: 123456, gstRate: 18 }] }, 'bold'],
      ['draft', { status: 'draft' }, 'classic'],
      ['long-40-lines', { lines }, 'consultant'],
    ];
    for (const [name, overrides, themeId] of cases) {
      const theme = PRESET_THEMES.find((candidate) => candidate.id === themeId);
      if (!theme) throw new Error(`Unknown theme ${themeId}`);
      const blob = await renderInvoicePdf({ invoice: makeInvoice(overrides), theme, fontBase: FONT_DIR });
      writeFileSync(join(out, `${name}.pdf`), Buffer.from(await blob.arrayBuffer()));
    }
  });
});
