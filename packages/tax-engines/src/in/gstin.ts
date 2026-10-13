import { isValidStateCode } from './states';

const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// 2-digit state code, 10-character PAN, entity number, literal "Z", check character
const PATTERN = /^(\d{2})([A-Z]{5}\d{4}[A-Z])([1-9A-Z])Z([0-9A-Z])$/;

/** GSTIN check character: base-36 weighted sum (weights 1,2,1,2,...) over the first 14 characters. */
export function gstinChecksumChar(first14: string): string {
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARSET.indexOf(first14.charAt(i));
    const product = value * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET.charAt((36 - (total % 36)) % 36);
}

export type GstinValidation =
  | { valid: true; stateCode: string; pan: string }
  | { valid: false; reason: string };

export function validateGstin(input: string): GstinValidation {
  const gstin = input.trim().toUpperCase();
  const match = PATTERN.exec(gstin);
  if (!match) {
    return {
      valid: false,
      reason:
        'GSTIN must be 15 characters: 2-digit state code, 10-character PAN, entity number, "Z" and a check character',
    };
  }
  const [, stateCode = '', pan = '', , check = ''] = match;
  if (!isValidStateCode(stateCode)) {
    return { valid: false, reason: `Unknown GST state code "${stateCode}"` };
  }
  if (gstinChecksumChar(gstin.slice(0, 14)) !== check) {
    return { valid: false, reason: 'GSTIN check character does not match' };
  }
  return { valid: true, stateCode, pan };
}
