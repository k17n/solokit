import { describe, expect, it } from 'vitest';
import { buildQrDataUrl } from './qr';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function decode(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
}

describe('buildQrDataUrl', () => {
  it('returns a PNG data URL', async () => {
    const url = await buildQrDataUrl('upi://pay?pa=asha@okhdfc&pn=Asha&am=100.00&cu=INR');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect([...decode(url).subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  });

  it('is deterministic and depends on the payload', async () => {
    const a = await buildQrDataUrl('upi://pay?pa=a@upi&am=1.00');
    const b = await buildQrDataUrl('upi://pay?pa=a@upi&am=1.00');
    const c = await buildQrDataUrl('upi://pay?pa=a@upi&am=2.00');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('honours the requested size', async () => {
    const png = decode(await buildQrDataUrl('hello', 120));
    // The PNG header stores the width and height at bytes 16 to 24.
    expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(100);
    expect(png.readUInt32BE(16)).toBeLessThanOrEqual(140);
    expect(png.readUInt32BE(20)).toBe(png.readUInt32BE(16));
  });

  it('rejects an empty payload', async () => {
    await expect(buildQrDataUrl('')).rejects.toThrow();
  });
});

describe('buildQrDataUrl scans back to its payload', () => {
  async function scan(dataUrl: string): Promise<string | null> {
    const { PNG } = await import('pngjs');
    const { default: jsQR } = await import('jsqr');
    const png = PNG.sync.read(decode(dataUrl));
    const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    return result ? result.data : null;
  }

  it('decodes to the exact UPI payment link', async () => {
    const payload = 'upi://pay?pa=asha@okhdfc&pn=Asha%20Rao%20Consulting&am=77760.00&cu=INR&tn=Invoice%202026-27%2F0001';
    expect(await scan(await buildQrDataUrl(payload))).toBe(payload);
  });

  it('still decodes at the small size the PDF uses', async () => {
    const payload = 'upi://pay?pa=a.b@upi&pn=A&am=0.50&cu=INR';
    expect(await scan(await buildQrDataUrl(payload, 160))).toBe(payload);
  });
});
