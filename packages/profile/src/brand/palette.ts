import { hexToRgb, rgbToHex, rgbToHsl } from '../colour';

/**
 * Brand colour extraction, step 1: a palette from pixels. Pure and deterministic (no random seeding), so the same
 * logo always gives the same colours.
 *
 * Algorithm (median cut):
 * 1. Keep only pixels that are mostly opaque (alpha >= 128). Transparent logos therefore ignore their background.
 * 2. Count the remaining pixels in a 32 x 32 x 32 grid (5 bits per channel) and remember each cell's exact mean colour.
 *    A flat red logo stays exactly its red; anti-aliasing noise is merged into a few cells.
 * 3. Start with one box holding every cell. Repeatedly take the box with the most pixels that still has more than one
 *    cell, sort its cells along the channel with the widest range and cut it where half of its pixels lie on each side.
 *    Stop at `maxColours` boxes.
 * 4. A box's colour is the pixel-weighted mean of its cells. Colours are ranked by pixel count (ties by hex).
 */

export interface PaletteColour {
  /** #RRGGBB. */
  hex: string;
  /** Pixels in this colour's box. */
  population: number;
  /** Share of the opaque pixels, 0 to 1. */
  share: number;
}

export interface Palette {
  /** Most common first. Empty when the image has no opaque pixels. */
  colours: PaletteColour[];
  /** Pixels counted (mostly opaque). */
  opaquePixels: number;
  /** All pixels in the image. */
  totalPixels: number;
}

export interface PaletteOptions {
  /** Most colours to return. Default 8. */
  maxColours?: number;
  /** Pixels with less alpha than this (0 to 255) are ignored. Default 128. */
  alphaThreshold?: number;
}

interface Cell {
  key: number;
  count: number;
  r: number;
  g: number;
  b: number;
}

const CHANNELS = ['r', 'g', 'b'] as const;

/** `pixels` is RGBA, four numbers per pixel, like canvas ImageData.data. */
export function extractPalette(pixels: ArrayLike<number>, options: PaletteOptions = {}): Palette {
  const maxColours = Math.max(1, Math.floor(options.maxColours ?? 8));
  const alphaThreshold = options.alphaThreshold ?? 128;
  const totalPixels = Math.floor(pixels.length / 4);

  const cells = new Map<number, Cell>();
  let opaquePixels = 0;
  for (let i = 0; i < totalPixels; i++) {
    const r = pixels[i * 4]!;
    const g = pixels[i * 4 + 1]!;
    const b = pixels[i * 4 + 2]!;
    const a = pixels[i * 4 + 3]!;
    if (!(a >= alphaThreshold)) continue;
    opaquePixels++;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const cell = cells.get(key);
    if (cell) {
      cell.count++;
      cell.r += r;
      cell.g += g;
      cell.b += b;
    } else {
      cells.set(key, { key, count: 1, r, g, b });
    }
  }
  if (opaquePixels === 0) return { colours: [], opaquePixels: 0, totalPixels };

  const population = (box: Cell[]) => box.reduce((sum, cell) => sum + cell.count, 0);
  let boxes: Cell[][] = [[...cells.values()].sort((a, b) => a.key - b.key)];

  while (boxes.length < maxColours) {
    let target = -1;
    let most = 0;
    boxes.forEach((box, index) => {
      const size = population(box);
      if (box.length > 1 && size > most) {
        most = size;
        target = index;
      }
    });
    if (target < 0) break;
    const box = boxes[target]!;

    const range = (channel: (typeof CHANNELS)[number]) => {
      const values = box.map((cell) => cell[channel] / cell.count);
      return Math.max(...values) - Math.min(...values);
    };
    const widest = CHANNELS.reduce((best, channel) => (range(channel) > range(best) ? channel : best), 'r' as (typeof CHANNELS)[number]);
    const sorted = [...box].sort((a, b) => a[widest] / a.count - b[widest] / b.count || a.key - b.key);

    let running = 0;
    let cut = 1;
    const half = most / 2;
    for (let i = 0; i < sorted.length - 1; i++) {
      running += sorted[i]!.count;
      cut = i + 1;
      if (running >= half) break;
    }
    boxes = [...boxes.slice(0, target), sorted.slice(0, cut), sorted.slice(cut), ...boxes.slice(target + 1)];
  }

  const colours = boxes
    .map((box): PaletteColour => {
      const size = population(box);
      let r = 0;
      let g = 0;
      let b = 0;
      for (const cell of box) {
        r += cell.r;
        g += cell.g;
        b += cell.b;
      }
      return { hex: rgbToHex([r / size, g / size, b / size]), population: size, share: size / opaquePixels };
    })
    .sort((a, b) => b.population - a.population || a.hex.localeCompare(b.hex));
  return { colours, opaquePixels, totalPixels };
}

/** Saturation and lightness (HSL, 0 to 1) of a palette colour. */
export function describeColour(hex: string): { h: number; s: number; l: number } {
  return rgbToHsl(hexToRgb(hex));
}
