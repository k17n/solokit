import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as fontkit from 'fontkit';
import JSZip from 'jszip';
import { SaxesParser } from 'saxes';
import { TEMPLATE_NOTICE, isPrintableInPdf } from '@solokit/tool-contract';
import { makeContract, makeParty } from '@solokit/tool-contract/testing';
import { PRESET_THEMES } from '@solokit/tool-invoice';
import { FONT_DIR, extractPdfText } from '@solokit/tool-invoice-pdf/testing';
import { describe, expect, it } from 'vitest';
import { renderContractDocx, renderReviewPackDocx } from './docx';
import { renderContractPdf, renderReviewPackPdf } from './render';

const theme = PRESET_THEMES.find((candidate) => candidate.id === 'classic')!;
const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());
const pdfText = async (blob: Blob) => (await extractPdfText(await bytesOf(blob))).join(' ');

/** Parses every XML part of a Word file with a strict XML 1.0 parser; throws at the first error. */
async function assertWellFormed(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  let documentXml = '';
  for (const name of Object.keys(zip.files)) {
    if (!/\.(xml|rels)$/.test(name)) continue;
    const xml = await zip.file(name)!.async('string');
    const parser = new SaxesParser({ xmlns: true });
    let failure: Error | undefined;
    parser.on('error', (error) => {
      failure ??= error;
    });
    parser.write(xml).close();
    if (failure) throw new Error(`${name} is not valid XML: ${failure.message}`);
    if (name === 'word/document.xml') documentXml = xml;
  }
  return documentXml;
}

const dirtyServices = () => {
  const base = makeContract('services');
  return {
    ...base,
    parties: [makeParty({ role: 'freelancer', name: 'Asha\u000BRao\u0001 Consulting', signatoryName: 'Asha\u000CRao' }), base.parties[1]!],
    variables: { ...base.variables, servicesDescription: 'Design a site\u000BSet up the form\u0000\u0008\u001F', deliverables: 'Files\u0007' },
    milestones: [{ id: 'm1', title: 'Design\u000B', amount: 40000, due: 'on approval\u0002' }, ...base.milestones.slice(1)],
  };
};

describe('control characters never reach an export', () => {
  it('give a Word file whose XML parses, with the text intact', async () => {
    const contract = dirtyServices();
    const xml = await assertWellFormed(await renderContractDocx(contract));
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(xml).toContain('Asha Rao Consulting');
    expect(xml).toContain('Design a site Set up the form');
  });

  it('also hold for the review pack in Word', async () => {
    const xml = await assertWellFormed(await renderReviewPackDocx(dirtyServices()));
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  });

  it('still make a PDF, with the text readable', async () => {
    const text = await pdfText(await renderReviewPackPdf({ contract: dirtyServices(), theme, fontBase: FONT_DIR }));
    expect(text).toContain('Asha Rao Consulting');
    expect(text).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  });
});

describe('characters the PDF fonts cannot print', () => {
  const contract = () => {
    const base = makeContract('nda-mutual');
    return { ...base, parties: [makeParty({ role: 'first', name: 'アシャ Consulting', signatoryName: 'आशा राव' }), base.parties[1]!] };
  };

  it('are kept in the Word version', async () => {
    const xml = await assertWellFormed(await renderContractDocx(contract()));
    expect(xml).toContain('アシャ Consulting');
    expect(xml).toContain('आशा राव');
  });

  it('do not stop the PDF being made, and the review pack says they will not print', async () => {
    const pack = await pdfText(await renderReviewPackPdf({ contract: contract(), theme, fontBase: FONT_DIR }));
    expect(pack).toContain('will not print in the PDF; the Word version will show them.');
    const word = await assertWellFormed(await renderReviewPackDocx(contract()));
    expect(word).toContain('will not print in the PDF; the Word version will show them.');
  });

  it('are judged against the fonts: nothing on the printable list is missing from any bundled font', () => {
    const fonts = ['inter', 'poppins', 'source-serif-4', 'inconsolata', 'geist-mono'].flatMap((id) => [`${id}-400.ttf`, `${id}-700.ttf`]);
    const missing: string[] = [];
    for (const file of fonts) {
      const font = fontkit.create(readFileSync(join(FONT_DIR, file)));
      for (let code = 0x20; code <= 0x2200; code++) {
        if (code === 0x7f || (code > 0x7e && code < 0xa0)) continue;
        if (isPrintableInPdf(code) && !font.hasGlyphForCodePoint(code)) missing.push(`${file} U+${code.toString(16)}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('the template notice in the body of the agreement', () => {
  it('is printed in the PDF before the signatures', async () => {
    const text = await pdfText(await renderContractPdf({ contract: makeContract('nda-mutual'), theme, fontBase: FONT_DIR }));
    expect(text).toContain(TEMPLATE_NOTICE);
    expect(text.indexOf(TEMPLATE_NOTICE)).toBeLessThan(text.indexOf('Signed by the Parties'));
    expect(text.indexOf(TEMPLATE_NOTICE)).toBeGreaterThan(text.indexOf('1. Background'));
  });

  it('is printed once, in the agreement and not again in the review pack text of the agreement', async () => {
    const text = await pdfText(await renderReviewPackPdf({ contract: makeContract('services'), theme, fontBase: FONT_DIR }));
    expect(text.split(TEMPLATE_NOTICE).length - 1).toBe(1);
  });

  it('is left out of body and footer only when showTemplateNotice is false', async () => {
    const text = await pdfText(await renderContractPdf({ contract: makeContract('nda-mutual'), theme, fontBase: FONT_DIR, showTemplateNotice: false }));
    expect(text).not.toContain('Not legal advice');
    expect(text).not.toContain('not legal advice');
  });

  it('is printed in the Word version before the signatures, and left out only when asked', async () => {
    const withNotice = await assertWellFormed(await renderContractDocx(makeContract('nda-mutual')));
    expect(withNotice).toContain(TEMPLATE_NOTICE);
    expect(withNotice.indexOf(TEMPLATE_NOTICE)).toBeLessThan(withNotice.indexOf('Signed by the Parties'));
    const without = await assertWellFormed(await renderContractDocx(makeContract('nda-mutual'), { showTemplateNotice: false }));
    expect(without).not.toContain(TEMPLATE_NOTICE);
  });

  it('is printed for a final agreement frozen before the notice was printed, using the standard text', async () => {
    const { buildContractDocument } = await import('@solokit/tool-contract');
    const draft = makeContract('nda-mutual');
    const frozen = { ...buildContractDocument(draft), notice: '' };
    const text = await pdfText(await renderContractPdf({ contract: { ...draft, status: 'final', finalDocument: frozen }, theme, fontBase: FONT_DIR }));
    expect(text).toContain(TEMPLATE_NOTICE);
  });
});
