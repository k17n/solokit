import { buildContractDocument } from '@solokit/tool-contract';
import { makeContract } from '@solokit/tool-contract/testing';
import { build } from 'esbuild';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { renderContractDocx, renderReviewPackDocx } from './docx';

async function open(blob: Blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  const numbering = await zip.file('word/numbering.xml')!.async('string');
  const paragraphs = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((match) => match[0]);
  const text = (p: string) => [...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
  const unescape = (value: string) => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return { zip, xml, numbering, paragraphs, text: (p: string) => unescape(text(p)), all: unescape(paragraphs.map(text).join('\n')) };
}

describe('renderContractDocx', () => {
  it('produces a Word file with the same content as the agreement', async () => {
    const contract = makeContract('services');
    const blob = await renderContractDocx(contract);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const { all, zip } = await open(blob);
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(['word/document.xml', 'word/numbering.xml', 'word/styles.xml']));
    const doc = buildContractDocument(contract);
    expect(all).toContain(doc.heading);
    expect(all).toContain(doc.introduction);
    for (const party of doc.parties) expect(all).toContain(party.text);
    for (const clause of doc.clauses) {
      expect(all).toContain(clause.title);
      for (const paragraph of clause.paragraphs) {
        expect(all).toContain(paragraph.text);
        for (const item of paragraph.items) expect(all).toContain(item.text);
      }
    }
    for (const schedule of doc.schedules) {
      expect(all).toContain(schedule.title);
      for (const section of schedule.sections) for (const line of section.lines) expect(all).toContain(line);
    }
    for (const signature of doc.signatures) {
      expect(all).toContain(signature.heading);
      expect(all).toContain(`Name: ${signature.signatoryName}`);
    }
    expect(all).toContain('Signature: ');
  });

  it('numbers headings and paragraphs with Word multilevel numbering that matches the typed cross-references', async () => {
    const contract = makeContract('nda-mutual');
    const { paragraphs, numbering } = await open(await renderContractDocx(contract));
    expect(numbering).toContain('w:val="%1."');
    expect(numbering).toContain('w:val="%1.%2"');
    expect(numbering).toContain('w:val="(%3)"');
    expect(numbering).toContain('w:val="lowerLetter"');

    // Walk the numbering the way Word does and compare with the numbers the document builder gave each paragraph.
    const counters = [0, 0, 0];
    const computed: string[] = [];
    for (const paragraph of paragraphs) {
      const level = /<w:ilvl w:val="(\d)"\/>/.exec(paragraph);
      if (!level || !paragraph.includes('<w:numId')) continue;
      const at = Number(level[1]);
      counters[at] = (counters[at] ?? 0) + 1;
      for (let deeper = at + 1; deeper < counters.length; deeper++) counters[deeper] = 0;
      computed.push(at === 0 ? `${counters[0]}` : at === 1 ? `${counters[0]}.${counters[1]}` : `${counters[0]}.${counters[1]}${String.fromCharCode(96 + (counters[2] ?? 0))}`);
    }
    const doc = buildContractDocument(contract);
    const expected = doc.clauses.flatMap((clause) => [clause.number, ...clause.paragraphs.flatMap((p) => [p.number, ...p.items.map((_i, index) => `${p.number}${String.fromCharCode(97 + index)}`)])]);
    expect(computed).toEqual(expected);
  });

  it('uses real heading styles for the title and the clause titles', async () => {
    const { xml } = await open(await renderContractDocx(makeContract('nda-one-way')));
    expect(xml).toContain('w:val="Heading1"');
    expect((xml.match(/w:val="Heading2"/g) ?? []).length).toBe(buildContractDocument(makeContract('nda-one-way')).clauses.length);
  });

  it('has page numbers "Page X of Y" and the template notice in the footer', async () => {
    const { zip } = await open(await renderContractDocx(makeContract('services')));
    const footerName = Object.keys(zip.files).find((name) => /word\/footer\d*\.xml/.test(name))!;
    const footer = await zip.file(footerName)!.async('string');
    expect(footer).toContain('Not legal advice');
    expect(footer).toMatch(/PAGE/);
    expect(footer).toMatch(/NUMPAGES/);
    expect(footer).toContain('Page ');
    const quiet = await open(await renderContractDocx(makeContract('services'), { showTemplateNotice: false }));
    const quietFooter = await quiet.zip.file(Object.keys(quiet.zip.files).find((name) => /word\/footer\d*\.xml/.test(name))!)!.async('string');
    expect(quietFooter).not.toContain('Not legal advice');
  });

  it('uses the theme accent colour for headings', async () => {
    const { zip } = await open(await renderContractDocx(makeContract('nda-mutual'), { theme: { accent: '#047857', text: '#14213D' } }));
    const styles = await zip.file('word/styles.xml')!.async('string');
    expect(styles).toContain('047857');
  });

  it('works for every kind and does not need the network', async () => {
    for (const kind of ['nda-mutual', 'nda-one-way', 'services'] as const) {
      const { all } = await open(await renderContractDocx(makeContract(kind)));
      expect(all, kind).not.toMatch(/\{\{|undefined|NaN/);
    }
  });

  it('prints a final agreement from its frozen wording', async () => {
    const draft = makeContract('nda-mutual');
    const frozen = { ...buildContractDocument(draft), heading: 'Frozen Wording Heading' };
    const { all } = await open(await renderContractDocx({ ...draft, status: 'final', finalDocument: frozen }));
    expect(all).toContain('Frozen Wording Heading');
  });
});

describe('renderReviewPackDocx', () => {
  it('adds the review summary after the agreement', async () => {
    const { all } = await open(await renderReviewPackDocx(makeContract('services')));
    expect(all.indexOf('Freelance Services Agreement')).toBeLessThan(all.indexOf('Review summary'));
    for (const text of ['Template, not legal advice.', 'Key dates', 'Choices made', 'Left at the template default', 'What this means:', 'Why it is here:', 'Questions for your lawyer', 'Verify for Maharashtra', 'Why there is no non-compete clause']) {
      expect(all, text).toContain(text);
    }
  });
});

describe('browser bundle', () => {
  it('bundles for the browser without Node-only modules', async () => {
    const result = await build({
      entryPoints: [new URL('./index.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
      bundle: true,
      platform: 'browser',
      format: 'esm',
      write: false,
      metafile: true,
      logLevel: 'silent',
      external: [],
      conditions: ['browser'],
      mainFields: ['browser', 'module', 'main'],
    }).catch((error: { errors?: { text: string }[] }) => {
      throw new Error(`Browser bundle failed: ${(error.errors ?? []).map((e) => e.text).join('; ')}`);
    });
    const inputs = Object.keys(result.metafile.inputs);
    expect(inputs.some((input) => /docx/.test(input))).toBe(true);
    expect(inputs.filter((input) => input.startsWith('node:') || /^(fs|path|crypto|stream|zlib|buffer)$/.test(input))).toEqual([]);
    for (const output of Object.values(result.metafile.outputs)) {
      for (const imported of output.imports) expect(imported.external ? imported.path : '', 'external import').toBe('');
    }
  }, 60_000);
});
