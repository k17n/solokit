import type { Minor } from '@solokit/core';

const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;

export interface UpiInput {
  upiId: string;
  payeeName: string;
  amountMinor: Minor;
  note?: string;
}

/** A upi://pay link a UPI app can open or scan. The amount is in rupees with two decimals. */
export function buildUpiPayload({ upiId, payeeName, amountMinor, note }: UpiInput): string {
  if (!UPI_ID.test(upiId)) throw new RangeError(`"${upiId}" is not a valid UPI id`);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new RangeError('The UPI amount must be a positive whole number of paise');
  }
  const amount = `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, '0')}`;
  const parts = [`pa=${upiId}`, `pn=${encodeURIComponent(payeeName)}`, `am=${amount}`, 'cu=INR'];
  if (note) parts.push(`tn=${encodeURIComponent(note)}`);
  return `upi://pay?${parts.join('&')}`;
}
