import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToHsl, hslToHex } from '../colour';
import { extractPaletteFromDataUrl, suggestBrandFromLogo, brandFromSuggestion, type PaletteDeps } from './browser';
import { extractPalette } from './palette';
import { FALLBACK_ACCENT, suggestBrandTheme, type BrandThemeSuggestion } from './theme';

type Rgba = readonly [number, number, number, number];

/** Builds RGBA pixel data from a list of [colour, how many pixels] runs. */
function pixels(...runs: [Rgba, number][]): Uint8ClampedArray {
  const total = runs.reduce((sum, [, count]) => sum + count, 0);
  const data = new Uint8ClampedArray(total * 4);
  let at = 0;
  for (const [colour, count] of runs) {
    for (let i = 0; i < count; i++) {
      data.set(colour, at);
      at += 4;
    }
  }
  return data;
}

const CLEAR: Rgba = [0, 0, 0, 0];
const RED: Rgba = [230, 30, 30, 255];
const BLUE: Rgba = [20, 70, 200, 255];
const YELLOW: Rgba = [250, 200, 20, 255];
const GREY: Rgba = [128, 128, 128, 255];
const BLACK: Rgba = [0, 0, 0, 255];
const WHITE: Rgba = [255, 255, 255, 255];

function expectReadable(theme: BrandThemeSuggestion) {
  expect(contrastRatio(theme.text, theme.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(theme.accent, theme.background)).toBeGreaterThanOrEqual(3);
  // Several layouts print white text on the accent.
  expect(contrastRatio('#FFFFFF', theme.accent)).toBeGreaterThanOrEqual(4.5);
  if (theme.secondary) expect(contrastRatio(theme.secondary, theme.background)).toBeGreaterThanOrEqual(3);
  for (const colour of [theme.accent, theme.text, theme.background, theme.secondary ?? '#000000']) expect(colour).toMatch(/^#[0-9A-F]{6}$/);
}

describe('extractPalette', () => {
  it('returns the logo colour for a flat red logo on a transparent background', () => {
    const palette = extractPalette(pixels([CLEAR, 600], [RED, 400]));
    expect(palette.totalPixels).toBe(1000);
    expect(palette.opaquePixels).toBe(400);
    expect(palette.colours).toHaveLength(1);
    expect(palette.colours[0]).toMatchObject({ hex: '#E61E1E', population: 400, share: 1 });
  });

  it('ranks colours by how much of the logo they cover', () => {
    const palette = extractPalette(pixels([BLUE, 300], [YELLOW, 100], [CLEAR, 50]));
    expect(palette.colours.map((colour) => colour.hex)).toEqual(['#1446C8', '#FAC814']);
    expect(palette.colours[0]!.share).toBeCloseTo(0.75);
  });

  it('is deterministic and does not depend on pixel order', () => {
    const forward = pixels([RED, 120], [BLUE, 80], [YELLOW, 40], [GREY, 20], [CLEAR, 10]);
    const backward = new Uint8ClampedArray(forward.length);
    for (let i = 0; i < forward.length / 4; i++) backward.set(forward.subarray(forward.length - 4 * (i + 1), forward.length - 4 * i), i * 4);
    expect(extractPalette(backward)).toEqual(extractPalette(forward));
    expect(extractPalette(forward)).toEqual(extractPalette(forward));
  });

  it('ignores mostly transparent edge pixels', () => {
    const palette = extractPalette(pixels([RED, 100], [[10, 200, 10, 90], 100]));
    expect(palette.colours.map((colour) => colour.hex)).toEqual(['#E61E1E']);
  });

  it('limits the number of colours', () => {
    const many = pixels(...Array.from({ length: 40 }, (_, i): [Rgba, number] => [[i * 6, 255 - i * 6, (i * 37) % 256, 255], 10]));
    expect(extractPalette(many, { maxColours: 5 }).colours.length).toBeLessThanOrEqual(5);
    expect(extractPalette(many).colours.length).toBeLessThanOrEqual(8);
  });

  it('returns nothing for an empty or fully transparent image', () => {
    expect(extractPalette(new Uint8ClampedArray(0))).toEqual({ colours: [], opaquePixels: 0, totalPixels: 0 });
    expect(extractPalette(pixels([CLEAR, 64])).colours).toEqual([]);
  });
});

describe('suggestBrandTheme', () => {
  it('uses the red of a red logo, darkened just enough for white text', () => {
    const theme = suggestBrandTheme(extractPalette(pixels([CLEAR, 600], [[255, 0, 0, 255], 400])));
    expect(theme.source).toBe('palette');
    expectReadable(theme);
    const original = hexToHsl('#FF0000');
    const accent = hexToHsl(theme.accent);
    expect(Math.abs(accent.h - original.h)).toBeLessThan(2);
    expect(accent.l).toBeLessThan(original.l);
    expect(original.l - accent.l).toBeLessThan(0.15);
    expect(theme.secondary).toBeUndefined();
    expect(theme.background).toBe('#FFFFFF');
  });

  it('keeps a colour that is already dark enough exactly as it is', () => {
    const theme = suggestBrandTheme(extractPalette(pixels([[11, 27, 58, 255], 100])));
    expect(theme.accent).toBe('#0B1B3A');
  });

  it('picks blue as the accent and yellow as the secondary for a blue and yellow logo', () => {
    const theme = suggestBrandTheme(extractPalette(pixels([BLUE, 300], [YELLOW, 200], [CLEAR, 100])));
    expectReadable(theme);
    expect(hexToHsl(theme.accent).h).toBeGreaterThan(200);
    expect(hexToHsl(theme.accent).h).toBeLessThan(240);
    expect(theme.secondary).toBeDefined();
    expect(hexToHsl(theme.secondary!).h).toBeGreaterThan(30);
    expect(hexToHsl(theme.secondary!).h).toBeLessThan(60);
  });

  it('ignores white and black parts of a coloured logo when choosing the accent', () => {
    const theme = suggestBrandTheme(extractPalette(pixels([WHITE, 5000], [BLACK, 1500], [GREY, 800], [BLUE, 400])));
    expectReadable(theme);
    expect(hexToHsl(theme.accent).h).toBeGreaterThan(200);
    expect(hexToHsl(theme.accent).s).toBeGreaterThan(0.5);
  });

  it('falls back to the most common non-white colour for a grey logo, with neutral text', () => {
    const theme = suggestBrandTheme(extractPalette(pixels([GREY, 300], [CLEAR, 100])));
    expect(theme.source).toBe('palette');
    expectReadable(theme);
    expect(hexToHsl(theme.accent).s).toBeLessThan(0.05);
    expect(theme.text).toBe('#1A1A1A');
  });

  it('suggests the default navy for a fully transparent logo', () => {
    const theme = suggestBrandTheme(extractPalette(pixels([CLEAR, 4096])));
    expect(theme).toMatchObject({ accent: FALLBACK_ACCENT, source: 'fallback', background: '#FFFFFF' });
    expectReadable(theme);
  });

  it('suggests the default navy for a white logo on a transparent background', () => {
    const theme = suggestBrandTheme(extractPalette(pixels([WHITE, 300], [CLEAR, 700])));
    expect(theme.source).toBe('fallback');
    expect(theme.accent).toBe(FALLBACK_ACCENT);
  });

  it('keeps a one-colour black logo black', () => {
    const theme = suggestBrandTheme(extractPalette(pixels([BLACK, 500], [CLEAR, 500])));
    expect(theme.source).toBe('palette');
    expect(theme.accent).toBe('#000000');
    expectReadable(theme);
  });

  it('is readable for every hue, saturation and lightness of a single-colour logo', () => {
    for (let h = 0; h < 360; h += 15) {
      for (const s of [0.3, 0.6, 1]) {
        for (const l of [0.12, 0.3, 0.5, 0.7, 0.88]) {
          const hex = hslToHex({ h, s, l });
          const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as [number, number, number];
          expectReadable(suggestBrandTheme(extractPalette(pixels([[r, g, b, 255], 50]))));
        }
      }
    }
  });

  it('turns a suggestion into profile brand colours', () => {
    const theme = suggestBrandTheme(extractPalette(pixels([BLUE, 300], [YELLOW, 200])));
    expect(brandFromSuggestion(theme)).toEqual({ primary: theme.accent, secondary: theme.secondary, text: theme.text, background: theme.background });
    expect(brandFromSuggestion(suggestBrandTheme(extractPalette(pixels([RED, 10]))))).not.toHaveProperty('secondary');
  });
});

function fakeDeps(width: number, height: number, data: ArrayLike<number>, seen: { size?: [number, number] } = {}): PaletteDeps {
  return {
    loadImage: async () => ({ width, height, source: 'image' }),
    createCanvas(w, h) {
      seen.size = [w, h];
      return { getContext: () => ({ drawImage: () => {}, getImageData: () => ({ data }) }) };
    },
  };
}

describe('extractPaletteFromDataUrl', () => {
  it('shrinks the logo to at most 64 pixels and reads its palette', async () => {
    const seen: { size?: [number, number] } = {};
    const palette = await extractPaletteFromDataUrl('data:image/png;base64,AAAA', {}, fakeDeps(600, 300, pixels([RED, 64 * 32]), seen));
    expect(seen.size).toEqual([64, 32]);
    expect(palette?.colours[0]?.hex).toBe('#E61E1E');
  });

  it('does not enlarge a small logo', async () => {
    const seen: { size?: [number, number] } = {};
    await extractPaletteFromDataUrl('data:x', {}, fakeDeps(20, 10, pixels([RED, 200]), seen));
    expect(seen.size).toEqual([20, 10]);
  });

  it('returns null, never throws, when there is no canvas, the image is broken or the canvas is blocked', async () => {
    expect(await extractPaletteFromDataUrl('data:x', {}, null)).toBeNull();
    expect(await extractPaletteFromDataUrl('', {}, fakeDeps(1, 1, []))).toBeNull();
    expect(await extractPaletteFromDataUrl('data:x', {}, { ...fakeDeps(1, 1, []), loadImage: () => Promise.reject(new Error('bad')) })).toBeNull();
    expect(await extractPaletteFromDataUrl('data:x', {}, fakeDeps(0, 0, []))).toBeNull();
    const blocked: PaletteDeps = { ...fakeDeps(2, 2, []), createCanvas: () => ({ getContext: () => ({ drawImage: () => {}, getImageData: () => { throw new Error('tainted'); } }) }) };
    expect(await extractPaletteFromDataUrl('data:x', {}, blocked)).toBeNull();
    const noContext: PaletteDeps = { ...fakeDeps(2, 2, []), createCanvas: () => ({ getContext: () => null }) };
    expect(await extractPaletteFromDataUrl('data:x', {}, noContext)).toBeNull();
  });

  it('uses no browser APIs by default outside a browser', async () => {
    expect(await extractPaletteFromDataUrl('data:image/png;base64,AAAA')).toBeNull();
  });

  it('suggestBrandFromLogo returns the palette and a suggestion together', async () => {
    const result = await suggestBrandFromLogo('data:x', fakeDeps(10, 10, pixels([BLUE, 100])));
    expect(result?.suggestion.source).toBe('palette');
    expect(result?.palette.opaquePixels).toBe(100);
    expect(await suggestBrandFromLogo('data:x', null)).toBeNull();
  });
});
