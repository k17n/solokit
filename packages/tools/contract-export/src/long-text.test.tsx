import { makeContract } from '@solokit/tool-contract/testing';
import { PRESET_THEMES } from '@solokit/tool-invoice';
import { FONT_DIR, extractPdfText } from '@solokit/tool-invoice-pdf/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderContractPdf, renderReviewPackPdf } from './render';

const theme = PRESET_THEMES.find((candidate) => candidate.id === 'classic')!;
const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

/** Numbered words, so a missing stretch of text cannot hide: "w0001 w0002 ...", exactly 4,990 characters. */
function longText(): string {
  const words: string[] = [];
  let length = 0;
  for (let n = 1; ; n++) {
    const word = `w${String(n).padStart(4, '0')}`;
    if (length + word.length + (words.length ? 1 : 0) > 4990) break;
    length += word.length + (words.length ? 1 : 0);
    words.push(word);
  }
  const text = words.join(' ');
  return text.length < 4990 ? `${text}${'x'.repeat(4990 - text.length)}` : text;
}

const NUMBERED = /\bw\d{4}\b/g;
const numberedWords = (text: string): string[] => text.match(NUMBERED) ?? [];

/** How many times each numbered word of the long text appears; a missing stretch shows as a zero. */
function countWords(text: string, expected: string[]): number[] {
  const counts = new Map(expected.map((word) => [word, 0]));
  for (const found of numberedWords(text)) if (counts.has(found)) counts.set(found, (counts.get(found) ?? 0) + 1);
  return [...counts.values()];
}

describe('very long text is never cut off', () => {
  afterEach(() => vi.restoreAllMocks());

  it("prints a 4,990-character purpose in full, in the agreement and in the review pack, with no \"can't wrap\" warning", async () => {
    const purpose = longText();
    expect(purpose).toHaveLength(4990);
    const warnings: string[] = [];
    const capture = (...args: unknown[]) => void warnings.push(args.map(String).join(' '));
    vi.spyOn(console, 'warn').mockImplementation(capture);
    vi.spyOn(console, 'error').mockImplementation(capture);
    vi.spyOn(console, 'log').mockImplementation(capture);

    const contract = makeContract('nda-mutual', { variables: { purpose } });
    const words = numberedWords(purpose);
    expect(words.length).toBeGreaterThan(600);

    const agreement = (await extractPdfText(await bytesOf(await renderContractPdf({ contract, theme, fontBase: FONT_DIR })))).join(' ');
    // Every word is on the page, in order, even though the page footer lands in the middle of the text.
    expect(numberedWords(agreement).slice(0, words.length)).toEqual(words);
    expect(countWords(agreement, words).every((count) => count >= 1)).toBe(true);

    const pack = (await extractPdfText(await bytesOf(await renderReviewPackPdf({ contract, theme, fontBase: FONT_DIR })))).join(' ');
    // The purpose appears in the agreement, in the "Choices made" list and in the question to the lawyer.
    expect(countWords(pack, words).every((count) => count >= 3)).toBe(true);

    expect(warnings.filter((line) => /wrap/i.test(line))).toEqual([]);
  });

  it('prints long services descriptions in full too', async () => {
    const text = longText();
    const base = makeContract('services');
    const contract = { ...base, variables: { ...base.variables, servicesDescription: text, deliverables: `${text}\nSecond item` } };
    const pdf = (await extractPdfText(await bytesOf(await renderReviewPackPdf({ contract, theme, fontBase: FONT_DIR })))).join(' ');
    const words = numberedWords(text);
    expect(countWords(pdf, words).every((count) => count >= 2)).toBe(true);
    expect(pdf).toContain('Second item');
  });
});
