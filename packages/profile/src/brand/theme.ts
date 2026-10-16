import { contrastRatio, hslToHex, type Hsl } from '../colour';
import { describeColour, type Palette, type PaletteColour } from './palette';

/**
 * Brand colour extraction, step 2: a readable theme from a palette.
 *
 * Choosing the accent: look at colours with at least 2% of the logo's pixels. A colour is "chromatic" when its HSL
 * saturation is at least 0.25 and its lightness is between 0.10 and 0.90, so white backgrounds, black outlines and
 * grey text never become the accent. Among chromatic colours the best is the one with the highest share weighted by
 * saturation (`share * (0.4 + saturation)`). The secondary is the next best chromatic colour that is clearly
 * different (hue at least 30 degrees away, or lightness at least 0.25 away). If nothing is chromatic (a black, white
 * or grey logo) the accent is the most common colour that is not near-white (lightness below 0.92); if the logo has
 * nothing but near-white or transparent pixels, the accent is the fallback navy.
 *
 * Making it readable. The themes are drawn on a white page, and some layouts print white text on the accent, so the
 * accent is darkened until white on it has a contrast ratio of at least 4.5 (WCAG AA for text). That also gives the
 * accent at least 4.5 against the white page, above the 3 that headings need. Only the HSL lightness is lowered, in
 * steps of 0.005 from the original, so hue and saturation (the brand's identity) are kept and the change is the
 * smallest that passes. The text colour is a very dark shade of the brand hue (lightness 0.12, saturation at most 0.35),
 * lowered further if it ever fell below 4.5 on the background; neutral logos get a neutral near-black.
 */

export const FALLBACK_ACCENT = '#0B1B3A';
export const NEUTRAL_TEXT = '#1A1A1A';
export const PAGE_BACKGROUND = '#FFFFFF';

export interface BrandThemeSuggestion {
  accent: string;
  /** A second brand colour, readable like the accent, when the logo has one. */
  secondary?: string;
  text: string;
  background: string;
  /** `palette`: taken from the logo. `fallback`: the logo had no usable colour, so a default navy is suggested. */
  source: 'palette' | 'fallback';
}

const MIN_SHARE = 0.02;
const WHITE_ON_ACCENT = 4.5;

function isChromatic(hex: string): boolean {
  const { s, l } = describeColour(hex);
  return s >= 0.25 && l >= 0.1 && l <= 0.9;
}

function isNearWhite(hex: string): boolean {
  return describeColour(hex).l >= 0.92;
}

/** The logo's accent colour before any contrast adjustment, or undefined if the logo has no usable colour. */
function pickAccent(palette: Palette): { accent: PaletteColour; secondary?: PaletteColour } | undefined {
  const sizeable = palette.colours.filter((colour) => colour.share >= MIN_SHARE);
  const chromatic = sizeable
    .filter((colour) => isChromatic(colour.hex))
    .map((colour) => ({ colour, score: colour.share * (0.4 + describeColour(colour.hex).s) }))
    .sort((a, b) => b.score - a.score || a.colour.hex.localeCompare(b.colour.hex))
    .map((entry) => entry.colour);
  const accent = chromatic[0] ?? sizeable.find((colour) => !isNearWhite(colour.hex));
  if (!accent) return undefined;
  const base = describeColour(accent.hex);
  const secondary = chromatic.slice(1).find((colour) => {
    const other = describeColour(colour.hex);
    const hueGap = Math.min(Math.abs(other.h - base.h), 360 - Math.abs(other.h - base.h));
    return hueGap >= 30 || Math.abs(other.l - base.l) >= 0.25;
  });
  return secondary ? { accent, secondary } : { accent };
}

/** Lowers lightness, as little as possible, until white text on the colour passes 4.5 and the colour passes 3 on the background. */
export function darkenForContrast(hex: string, background: string = PAGE_BACKGROUND): string {
  const ok = (candidate: string) => contrastRatio('#FFFFFF', candidate) >= WHITE_ON_ACCENT && contrastRatio(candidate, background) >= 3;
  if (ok(hex)) return hex;
  const hsl: Hsl = describeColour(hex);
  for (let l = Math.floor(hsl.l * 200) / 200; l >= 0; l -= 0.005) {
    const candidate = hslToHex({ ...hsl, l: Math.max(0, l) });
    if (ok(candidate)) return candidate;
  }
  return '#000000';
}

function textFor(accent: string | undefined, background: string): string {
  if (!accent) return NEUTRAL_TEXT;
  const { h, s } = describeColour(accent);
  if (s < 0.1) return NEUTRAL_TEXT;
  for (let l = 0.12; l >= 0; l -= 0.01) {
    const candidate = hslToHex({ h, s: Math.min(s, 0.35), l: Math.max(0, l) });
    if (contrastRatio(candidate, background) >= 4.5) return candidate;
  }
  return '#000000';
}

/** Always returns a theme that passes `validateTheme` for every layout. See the algorithm above. */
export function suggestBrandTheme(palette: Palette): BrandThemeSuggestion {
  const background = PAGE_BACKGROUND;
  const picked = pickAccent(palette);
  if (!picked) {
    return { accent: FALLBACK_ACCENT, text: NEUTRAL_TEXT, background, source: 'fallback' };
  }
  const accent = darkenForContrast(picked.accent.hex, background);
  const secondary = picked.secondary ? darkenForContrast(picked.secondary.hex, background) : undefined;
  return {
    accent,
    ...(secondary && secondary !== accent ? { secondary } : {}),
    text: textFor(describeColour(accent).s >= 0.1 ? accent : undefined, background),
    background,
    source: 'palette',
  };
}
