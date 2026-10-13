import { describe, expect, it, vi } from 'vitest';
import { LogoError, MAX_LOGO_BYTES, fitWithin, processLogoFile, type LogoDeps } from './logo';

function fakeDeps(image: { width: number; height: number }) {
  const drawImage = vi.fn();
  const canvases: { width: number; height: number }[] = [];
  const deps: LogoDeps = {
    loadImage: async () => ({ ...image, source: 'bitmap' }),
    createCanvas: (width, height) => {
      canvases.push({ width, height });
      return {
        getContext: () => ({ drawImage }),
        toDataURL: (type: string) => `data:${type};base64,FAKE`,
      };
    },
  };
  return { deps, drawImage, canvases };
}

const file = (type: string, size = 1000, name = 'logo') => new File([new Uint8Array(size)], name, { type });

describe('fitWithin', () => {
  it('keeps the aspect ratio inside the limits', () => {
    expect(fitWithin(1200, 600, 600, 300)).toEqual({ width: 600, height: 300 });
    expect(fitWithin(1200, 1200, 600, 300)).toEqual({ width: 300, height: 300 });
    expect(fitWithin(300, 900, 600, 300)).toEqual({ width: 100, height: 300 });
  });

  it('never enlarges', () => {
    expect(fitWithin(200, 100, 600, 300)).toEqual({ width: 200, height: 100 });
  });

  it('rounds to whole pixels and never goes below 1', () => {
    expect(fitWithin(1000, 3, 600, 300)).toEqual({ width: 600, height: 2 });
    expect(fitWithin(1, 1000, 600, 300)).toEqual({ width: 1, height: 300 });
    expect(fitWithin(10000, 1, 600, 300)).toEqual({ width: 600, height: 1 });
  });
});

describe('processLogoFile', () => {
  it('draws the image scaled down onto a canvas and returns a PNG data URL', async () => {
    const { deps, drawImage, canvases } = fakeDeps({ width: 1200, height: 600 });
    const url = await processLogoFile(file('image/jpeg'), deps);
    expect(url).toBe('data:image/png;base64,FAKE');
    expect(canvases).toEqual([{ width: 600, height: 300 }]);
    expect(drawImage).toHaveBeenCalledWith('bitmap', 0, 0, 600, 300);
  });

  it('accepts SVG, WebP and GIF as well as PNG and JPEG', async () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']) {
      const { deps } = fakeDeps({ width: 100, height: 50 });
      await expect(processLogoFile(file(type), deps)).resolves.toBe('data:image/png;base64,FAKE');
    }
  });

  it('rejects other file types with a plain message', async () => {
    const { deps } = fakeDeps({ width: 100, height: 50 });
    const error = await processLogoFile(file('application/pdf'), deps).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(LogoError);
    expect((error as Error).message).toBe('Choose a PNG, JPEG, WebP, GIF or SVG image.');
  });

  it('rejects files that are too big or empty', async () => {
    const { deps } = fakeDeps({ width: 100, height: 50 });
    await expect(processLogoFile(file('image/png', MAX_LOGO_BYTES + 1), deps)).rejects.toThrow('smaller than 5 MB');
    await expect(processLogoFile(file('image/png', 0), deps)).rejects.toThrow('empty');
  });

  it('reports an image that cannot be read', async () => {
    const deps: LogoDeps = {
      loadImage: () => Promise.reject(new Error('decode failed')),
      createCanvas: () => {
        throw new Error('not reached');
      },
    };
    await expect(processLogoFile(file('image/png'), deps)).rejects.toThrow('could not be read');
  });

  it('reports a browser that cannot draw', async () => {
    const deps: LogoDeps = {
      loadImage: async () => ({ width: 10, height: 10, source: 'x' }),
      createCanvas: () => ({ getContext: () => null, toDataURL: () => '' }),
    };
    await expect(processLogoFile(file('image/png'), deps)).rejects.toThrow('could not be read');
  });

  it('rejects an image with no size', async () => {
    const { deps } = fakeDeps({ width: 0, height: 0 });
    await expect(processLogoFile(file('image/png'), deps)).rejects.toThrow('could not be read');
  });
});
