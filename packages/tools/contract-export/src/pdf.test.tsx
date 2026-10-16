import { ContractRenderError } from '@solokit/tool-contract';
import { makeContract } from '@solokit/tool-contract/testing';
import { PRESET_THEMES } from '@solokit/tool-invoice';
import { FONT_DIR, extractPdfText } from '@solokit/tool-invoice-pdf/testing';
import { describe, expect, it } from 'vitest';
import { contractFilename, renderContractPdf, renderReviewPackPdf } from './render';

const theme = (id: string) => PRESET_THEMES.find((candidate) => candidate.id === id)!;
const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());
const input = (kind: Parameters<typeof makeContract>[0], themeId = 'classic', extra = {}) => ({ contract: makeContract(kind), theme: theme(themeId), fontBase: FONT_DIR, ...extra });

describe('renderContractPdf', () => {
  it('prints the agreement: heading, parties, numbered clauses, schedule and signature blocks', async () => {
    const blob = await renderContractPdf(input('services'));
    expect(blob.type).toBe('application/pdf');
    const bytes = await bytesOf(blob);
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-');
    const pages = await extractPdfText(bytes);
    const all = pages.join(' ');
    expect(all).toContain('Freelance Services Agreement');
    expect(all).toContain('Asha Rao Consulting');
    expect(all).toContain('Northwind Traders Private Limited');
    expect(all).toContain('1. Background');
    expect(all).toContain('4.1 The Client will pay the Freelancer a fixed fee of INR 1,20,000');
    expect(all).toContain('(a) is or becomes public');
    expect(all).toContain('Schedule 1 - Services, Deliverables, Timetable and Fees');
    expect(all).toContain('Design a five-page marketing website');
    expect(all).toContain('Signed for and on behalf of Asha Rao Consulting (the Freelancer)');
    expect(all).toContain('Signature');
    expect(all).toContain('Date');
    expect(all).toContain('Place');
    expect(all).toContain('Name: Ravi Menon');
    expect(all).toContain('Title: Director');
  });

  it('numbers every page "Page X of Y" and prints the template notice in the footer', async () => {
    const pages = await extractPdfText(await bytesOf(await renderContractPdf(input('services'))));
    expect(pages.length).toBeGreaterThan(3);
    pages.forEach((page, index) => {
      expect(page, `page ${index + 1}`).toContain(`Page ${index + 1} of ${pages.length}`);
      expect(page).toContain('Prepared from a SoloKit template. Not legal advice.');
    });
  });

  it('can leave the template notice out of the footer', async () => {
    const pages = await extractPdfText(await bytesOf(await renderContractPdf(input('nda-mutual', 'classic', { showTemplateNotice: false }))));
    expect(pages.join(' ')).not.toContain('Not legal advice');
    expect(pages[0]).toContain('Page 1 of');
  });

  it('prints the NDA kinds with their own headings and role names', async () => {
    const mutual = (await extractPdfText(await bytesOf(await renderContractPdf(input('nda-mutual'))))).join(' ');
    const oneWay = (await extractPdfText(await bytesOf(await renderContractPdf(input('nda-one-way'))))).join(' ');
    expect(mutual).toContain('Mutual Non-Disclosure Agreement');
    expect(mutual).toContain('First Party');
    expect(oneWay).toContain('Disclosing Party');
    expect(oneWay).toContain('Receiving Party');
    expect(oneWay).not.toContain('Mutual Non-Disclosure');
  });

  it('works with every preset theme and every bundled font', async () => {
    for (const preset of PRESET_THEMES) {
      const blob = await renderContractPdf({ contract: makeContract('nda-one-way'), theme: preset, fontBase: FONT_DIR });
      expect(blob.size, preset.id).toBeGreaterThan(5000);
    }
    for (const fontId of ['inter', 'poppins', 'source-serif-4', 'inconsolata', 'geist-mono'] as const) {
      const pages = await extractPdfText(await bytesOf(await renderContractPdf({ contract: makeContract('nda-mutual'), theme: { ...theme('classic'), fontId }, fontBase: FONT_DIR })));
      expect(pages.join(' '), fontId).toContain('Mutual Non-Disclosure Agreement');
    }
  });

  it('throws for an incomplete agreement instead of printing blanks', async () => {
    await expect(renderContractPdf({ contract: makeContract('nda-mutual', { variables: {} }), theme: theme('classic'), fontBase: FONT_DIR })).rejects.toBeInstanceOf(ContractRenderError);
  });

  it('prints a final agreement from its frozen wording', async () => {
    const { buildContractDocument } = await import('@solokit/tool-contract');
    const draft = makeContract('nda-mutual');
    const frozen = { ...buildContractDocument(draft), heading: 'Frozen Wording Heading' };
    const pages = await extractPdfText(await bytesOf(await renderContractPdf({ contract: { ...draft, status: 'final', finalDocument: frozen }, theme: theme('classic'), fontBase: FONT_DIR })));
    expect(pages.join(' ')).toContain('Frozen Wording Heading');
  });
});

describe('renderReviewPackPdf', () => {
  it('puts the agreement first and the review summary after it, with the notice', async () => {
    const agreement = await extractPdfText(await bytesOf(await renderContractPdf(input('services'))));
    const pages = await extractPdfText(await bytesOf(await renderReviewPackPdf(input('services'))));
    expect(pages.length).toBeGreaterThan(agreement.length);
    const all = pages.join(' ');
    expect(all.indexOf('Freelance Services Agreement')).toBeLessThan(all.indexOf('Review summary'));
    const summary = pages.slice(agreement.length).join(' ');
    expect(summary).toContain('Template, not legal advice.');
    expect(summary).toContain('Key dates');
    expect(summary).toContain('Choices made');
    expect(summary).toContain('Left at the template default');
    expect(summary).toContain('Clause by clause, in plain English');
    expect(summary).toContain('What this means:');
    expect(summary).toContain('Why it is here:');
    expect(summary).toContain('Check with a lawyer');
    expect(summary).toContain('Questions for your lawyer');
    expect(summary).toContain('Intellectual property assignment');
    expect(summary).toContain('Verify for Maharashtra');
    expect(summary).toContain('Why there is no non-compete clause');
    // Pages keep counting through both parts.
    pages.forEach((page, index) => expect(page).toContain(`Page ${index + 1} of ${pages.length}`));
  });

  it('works for each kind of agreement', async () => {
    for (const kind of ['nda-mutual', 'nda-one-way', 'services'] as const) {
      const text = (await extractPdfText(await bytesOf(await renderReviewPackPdf(input(kind))))).join(' ');
      expect(text, kind).toContain('Review summary');
      expect(text, kind).toContain('Template, not legal advice');
    }
  });
});

describe('contractFilename', () => {
  it('names files after the contract title', () => {
    expect(contractFilename({ title: 'NDA with Acme / Q4', kind: 'nda-mutual' }, 'agreement', 'pdf')).toBe('NDA-with-Acme-Q4.pdf');
    expect(contractFilename({ title: 'NDA with Acme', kind: 'nda-mutual' }, 'review-pack', 'docx')).toBe('NDA-with-Acme-Review-Pack.docx');
  });
  it('falls back to the kind when there is no title', () => {
    expect(contractFilename({ title: '  ', kind: 'services' }, 'agreement', 'pdf')).toBe('Freelance-services-agreement.pdf');
    expect(contractFilename({ title: '///', kind: 'services' }, 'agreement', 'pdf')).toBe('Agreement.pdf');
  });
});
