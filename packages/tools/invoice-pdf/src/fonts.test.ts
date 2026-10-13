import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as fontkit from 'fontkit';
import { FONT_OPTIONS } from '@solokit/tool-invoice';
import { describe, expect, it } from 'vitest';
import { FONT_DIR } from './testing';

const REQUIRED = ['₹', '€', '£', '$', 'é', 'Ł', 'ž'];
const WEIGHTS = [400, 700];

interface Manifest {
  families: { id: string; label: string; modified: boolean; reservedFontName: string | null }[];
}
const manifest = JSON.parse(readFileSync(join(FONT_DIR, 'fonts.json'), 'utf8')) as Manifest;
const readLicences = () => readFileSync(join(FONT_DIR, 'THIRD_PARTY_LICENSES.txt'), 'utf8');
const licenceHeader = () => readLicences().split(/^==== /m)[0] ?? '';

describe('bundled invoice fonts', () => {
  it('has a file for every font option and weight', () => {
    for (const font of FONT_OPTIONS) {
      for (const weight of WEIGHTS) {
        expect(existsSync(join(FONT_DIR, `${font.id}-${weight}.ttf`)), `${font.id}-${weight}`).toBe(true);
      }
    }
  });

  it('contains the rupee, euro, pound and dollar signs and accented Latin letters in every file', () => {
    for (const font of FONT_OPTIONS) {
      for (const weight of WEIGHTS) {
        const file = join(FONT_DIR, `${font.id}-${weight}.ttf`);
        const parsed = fontkit.create(readFileSync(file)) as fontkit.Font;
        const missing = REQUIRED.filter((character) => !parsed.hasGlyphForCodePoint(character.codePointAt(0) as number));
        expect(missing, `${font.id}-${weight} is missing ${missing.join(' ')}`).toEqual([]);
      }
    }
  });

  it('keeps every file small enough to precache', () => {
    for (const font of FONT_OPTIONS) {
      for (const weight of WEIGHTS) {
        const bytes = statSync(join(FONT_DIR, `${font.id}-${weight}.ttf`)).size;
        expect(bytes, `${font.id}-${weight}`).toBeLessThan(350 * 1024);
      }
    }
  });

  it('ships each family with its licence and a copyright line', () => {
    const licences = readLicences();
    for (const family of manifest.families) {
      expect(licences).toContain(`==== ${family.label} ====`);
      const block = (licences.split(`==== ${family.label} ====`)[1] ?? '').split(/^==== /m)[0] ?? '';
      const lines = block.split('\n').map((line) => line.trim());
      expect(
        lines.some((line) => line.startsWith('Copyright') || line.startsWith('©')),
        `${family.label} has a copyright line`,
      ).toBe(true);
    }
    expect(licences.match(/SIL OPEN FONT LICENSE Version 1\.1/g)?.length).toBe(manifest.families.length);
  });

  describe('font licensing manifest', () => {
    it('lists every font option exactly once', () => {
      for (const font of FONT_OPTIONS) {
        expect(manifest.families.filter((family) => family.id === font.id), font.id).toHaveLength(1);
      }
      expect(manifest.families).toHaveLength(FONT_OPTIONS.length);
    });

    it('ships fonts with a reserved name, or listed as unmodified in the licence header, unmodified', () => {
      const header = licenceHeader();
      const unmodifiedLine = header.split('\n').find((line) => /unmodified/i.test(line)) ?? '';
      for (const family of manifest.families) {
        if (family.reservedFontName !== null || unmodifiedLine.includes(family.label)) {
          expect(family.modified, family.label).toBe(false);
        }
      }
    });

    it('keeps unmodified fonts whole, with their original family name', () => {
      for (const family of manifest.families.filter((entry) => !entry.modified)) {
        for (const weight of WEIGHTS) {
          const parsed = fontkit.create(readFileSync(join(FONT_DIR, `${family.id}-${weight}.ttf`))) as fontkit.Font;
          expect(parsed.numGlyphs, `${family.id}-${weight} glyphs`).toBeGreaterThan(600);
          expect(parsed.familyName, `${family.id}-${weight} family name`).toBe(family.label);
        }
      }
    });

    it('never gives a modified font a reserved name', () => {
      const reservedNames = manifest.families.flatMap((family) => (family.reservedFontName ? [family.reservedFontName] : []));
      for (const family of manifest.families.filter((entry) => entry.modified)) {
        for (const weight of WEIGHTS) {
          const parsed = fontkit.create(readFileSync(join(FONT_DIR, `${family.id}-${weight}.ttf`))) as fontkit.Font;
          for (const name of reservedNames) {
            expect(parsed.familyName, `${family.id}-${weight} must not contain "${name}"`).not.toContain(name);
          }
        }
      }
    });

    it('names every unmodified family in the licence header', () => {
      const header = licenceHeader();
      for (const family of manifest.families.filter((entry) => !entry.modified)) {
        expect(header, family.label).toContain(family.label);
      }
    });
  });
});
