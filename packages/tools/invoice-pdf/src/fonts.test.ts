import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as fontkit from 'fontkit';
import { FONT_OPTIONS } from '@solokit/tool-invoice';
import { describe, expect, it } from 'vitest';
import { FONT_DIR } from './testing';

const REQUIRED = ['₹', '€', '£', '$', 'é', 'Ł', 'ž'];
const WEIGHTS = [400, 700];

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
        expect(bytes, `${font.id}-${weight}`).toBeLessThan(300 * 1024);
      }
    }
  });

  it('ships each family with its licence and copyright', () => {
    const licences = readFileSync(join(FONT_DIR, 'THIRD_PARTY_LICENSES.txt'), 'utf8');
    for (const label of ['Inter', 'Poppins', 'Source Serif 4', 'IBM Plex Mono', 'Geist Mono']) {
      expect(licences).toContain(`==== ${label} ====`);
    }
    expect(licences.match(/SIL OPEN FONT LICENSE Version 1\.1/g)?.length).toBe(5);
    expect(licences).toContain('Copyright');
  });

  it('keeps IBM Plex Mono unmodified because its licence reserves the name', () => {
    const licences = readFileSync(join(FONT_DIR, 'THIRD_PARTY_LICENSES.txt'), 'utf8');
    expect(licences).toContain('Reserved Font Name "Plex"');
    const parsed = fontkit.create(readFileSync(join(FONT_DIR, 'ibm-plex-mono-400.ttf'))) as fontkit.Font;
    expect(parsed.familyName).toBe('IBM Plex Mono');
    // The unmodified font still has its full set of glyphs, far more than the Latin subset.
    expect(parsed.numGlyphs).toBeGreaterThan(900);
  });
});
