import QRCode from 'qrcode';

/** A QR code as a PNG data URL. react-pdf draws it with <Image>. */
export function buildQrDataUrl(payload: string, size = 240): Promise<string> {
  return QRCode.toDataURL(payload, { margin: 0, width: size, errorCorrectionLevel: 'M', type: 'image/png' });
}
