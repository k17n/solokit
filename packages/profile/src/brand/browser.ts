import { extractPalette, type Palette, type PaletteOptions } from './palette';
import { suggestBrandTheme, type BrandThemeSuggestion } from './theme';
import type { BrandColours } from '../model';

/** The longest side the logo is shrunk to before its pixels are read. Small is enough for a palette and fast. */
export const PALETTE_SAMPLE_SIZE = 64;

export interface SampleCanvas {
  getContext(kind: '2d'): {
    drawImage(source: unknown, x: number, y: number, width: number, height: number): void;
    getImageData(x: number, y: number, width: number, height: number): { data: ArrayLike<number> };
  } | null;
}

export interface PaletteDeps {
  loadImage(dataUrl: string): Promise<{ width: number; height: number; source: unknown }>;
  createCanvas(width: number, height: number): SampleCanvas;
}

function browserDeps(): PaletteDeps | null {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  return {
    loadImage: (dataUrl) =>
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight, source: image });
        image.onerror = () => reject(new Error('The image could not be decoded'));
        image.src = dataUrl;
      }),
    createCanvas(width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return { getContext: () => canvas.getContext('2d', { willReadFrequently: true }) as ReturnType<SampleCanvas['getContext']> };
    },
  };
}

/**
 * Reads a logo (a data URL) into a palette using a canvas, after shrinking it to at most 64 pixels on a side.
 * Never throws: returns null when there is no canvas (server, old browser, test), the image cannot be decoded, or the
 * canvas refuses to give its pixels back.
 */
export async function extractPaletteFromDataUrl(dataUrl: string, options: PaletteOptions = {}, deps: PaletteDeps | null = browserDeps()): Promise<Palette | null> {
  if (!deps || typeof dataUrl !== 'string' || dataUrl === '') return null;
  try {
    const loaded = await deps.loadImage(dataUrl);
    if (!(loaded.width > 0 && loaded.height > 0)) return null;
    const scale = Math.min(1, PALETTE_SAMPLE_SIZE / Math.max(loaded.width, loaded.height));
    const width = Math.max(1, Math.round(loaded.width * scale));
    const height = Math.max(1, Math.round(loaded.height * scale));
    const context = deps.createCanvas(width, height).getContext('2d');
    if (!context) return null;
    context.drawImage(loaded.source, 0, 0, width, height);
    return extractPalette(context.getImageData(0, 0, width, height).data, options);
  } catch {
    return null;
  }
}

/** The profile's brand colours for a suggestion: the accent is the primary colour. */
export function brandFromSuggestion(suggestion: BrandThemeSuggestion): BrandColours {
  return {
    primary: suggestion.accent,
    ...(suggestion.secondary ? { secondary: suggestion.secondary } : {}),
    text: suggestion.text,
    background: suggestion.background,
  };
}

/** Logo to suggested brand colours in one step, or null when the logo could not be read. */
export async function suggestBrandFromLogo(dataUrl: string, deps?: PaletteDeps | null): Promise<{ palette: Palette; suggestion: BrandThemeSuggestion } | null> {
  const palette = await extractPaletteFromDataUrl(dataUrl, {}, deps);
  return palette ? { palette, suggestion: suggestBrandTheme(palette) } : null;
}
