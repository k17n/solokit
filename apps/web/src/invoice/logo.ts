export const MAX_LOGO_BYTES = 5 * 1024 * 1024;
export const MAX_LOGO_WIDTH = 600;
export const MAX_LOGO_HEIGHT = 300;
export const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'] as const;

export class LogoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LogoError';
  }
}

/** Scales a size down to fit the limits, keeping the aspect ratio. Never enlarges; whole pixels, at least 1. */
export function fitWithin(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface LogoCanvas {
  getContext(kind: '2d'): { drawImage(source: unknown, x: number, y: number, width: number, height: number): void } | null;
  toDataURL(type: string): string;
}

export interface LogoDeps {
  loadImage(file: File): Promise<{ width: number; height: number; source: unknown }>;
  createCanvas(width: number, height: number): LogoCanvas;
}

const browserDeps: LogoDeps = {
  loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: image.naturalWidth, height: image.naturalHeight, source: image });
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('The image could not be decoded'));
      };
      image.src = url;
    });
  },
  createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return {
      getContext: () => canvas.getContext('2d') as ReturnType<LogoCanvas['getContext']>,
      toDataURL: (type) => canvas.toDataURL(type),
    };
  },
};

const UNREADABLE = 'That image could not be read. Try a PNG or JPEG file.';

/**
 * Re-encodes a chosen logo as a PNG data URL no larger than 600 x 300 pixels. PDFs can draw PNG and JPEG only,
 * and keeping the logo small keeps backups and invoices small. Transparency is kept.
 */
export async function processLogoFile(file: File, deps: LogoDeps = browserDeps): Promise<string> {
  if (!(ACCEPTED_LOGO_TYPES as readonly string[]).includes(file.type)) {
    throw new LogoError('Choose a PNG, JPEG, WebP, GIF or SVG image.');
  }
  if (file.size === 0) throw new LogoError('That file is empty.');
  if (file.size > MAX_LOGO_BYTES) throw new LogoError('Choose an image smaller than 5 MB.');

  let loaded: Awaited<ReturnType<LogoDeps['loadImage']>>;
  try {
    loaded = await deps.loadImage(file);
  } catch {
    throw new LogoError(UNREADABLE);
  }
  if (!(loaded.width > 0 && loaded.height > 0)) throw new LogoError(UNREADABLE);

  const size = fitWithin(loaded.width, loaded.height, MAX_LOGO_WIDTH, MAX_LOGO_HEIGHT);
  const canvas = deps.createCanvas(size.width, size.height);
  const context = canvas.getContext('2d');
  if (!context) throw new LogoError(UNREADABLE);
  context.drawImage(loaded.source, 0, 0, size.width, size.height);
  return canvas.toDataURL('image/png');
}
