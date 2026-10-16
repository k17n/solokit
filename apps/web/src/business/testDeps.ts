import type { PaletteDeps } from '@solokit/profile';

type Rgb = [number, number, number];

/** Fake logo reading for tests: an image whose pixels are the given colours, each repeated. */
export function fakePaletteDeps(...parts: [Rgb, number][]): PaletteDeps {
  const data: number[] = [];
  for (const [[r, g, b], count] of parts) for (let i = 0; i < count; i++) data.push(r, g, b, 255);
  const side = Math.ceil(Math.sqrt(data.length / 4));
  while (data.length < side * side * 4) data.push(0, 0, 0, 0);
  return {
    loadImage: async () => ({ width: side, height: side, source: {} }),
    createCanvas: () => ({ getContext: () => ({ drawImage: () => {}, getImageData: () => ({ data }) }) }),
  };
}

export const RED_LOGO: [Rgb, number] = [[200, 30, 30], 300];
export const BLUE_LOGO: [Rgb, number] = [[30, 60, 200], 300];
