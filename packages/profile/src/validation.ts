import { InvoiceNumberError, formatInvoiceNumber } from '@solokit/core';
import { validateGstin } from '@solokit/tax-engines';
import { isHexColour } from './colour';
import type { BusinessProfile, Issue } from './model';

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER = /^\d{9,18}$/;
const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
const UDYAM = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isBlank = (value: string | undefined) => value === undefined || value.trim() === '';

export function validateProfile(profile: BusinessProfile): Issue[] {
  const issues: Issue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  if (isBlank(profile.name)) add('name', 'Enter your name or business name');
  if (isBlank(profile.address.line1)) add('address.line1', 'Enter the first line of your address');
  if (isBlank(profile.address.city)) add('address.city', 'Enter your city');

  if (profile.gstStatus === 'unregistered') {
    if (!isBlank(profile.gstin)) {
      add('gstin', 'Remove the GSTIN, or choose Regular or Composition as your GST status');
    }
  } else if (isBlank(profile.gstin)) {
    add('gstin', 'Enter your GSTIN');
  } else {
    const result = validateGstin(profile.gstin ?? '');
    if (!result.valid) {
      add('gstin', result.reason);
    } else if (profile.address.stateCode !== result.stateCode) {
      add('address.stateCode', 'The state must match the first two digits of your GSTIN');
    }
  }

  if (profile.gstStatus !== 'unregistered' && isBlank(profile.address.stateCode)) {
    if (!issues.some((issue) => issue.path === 'address.stateCode')) add('address.stateCode', 'Choose your state');
  }

  if (!isBlank(profile.pan) && !PAN.test(profile.pan ?? '')) add('pan', 'PAN looks like ABCDE1234F');
  if (!isBlank(profile.udyam) && !UDYAM.test(profile.udyam ?? '')) add('udyam', 'UDYAM number looks like UDYAM-MH-19-0012345');
  if (!isBlank(profile.email) && !EMAIL.test(profile.email ?? '')) add('email', 'Enter a valid email address');
  if (!isBlank(profile.upiId) && !UPI_ID.test(profile.upiId ?? '')) add('upiId', 'UPI ID looks like name@bank');

  if (profile.invoicePrefix) {
    try {
      formatInvoiceNumber({ prefix: profile.invoicePrefix, fiscalYear: '2026-27', sequence: 1 });
    } catch (error) {
      if (!(error instanceof InvoiceNumberError)) throw error;
      add('invoicePrefix', 'Use at most 4 letters, digits, "/" or "-" so the number stays within 16 characters');
    }
  }

  if (profile.bank) {
    if (!ACCOUNT_NUMBER.test(profile.bank.accountNumber)) add('bank.accountNumber', 'Account number has 9 to 18 digits');
    if (!IFSC.test(profile.bank.ifsc)) add('bank.ifsc', 'IFSC looks like HDFC0001234');
  }

  if (profile.brand) {
    for (const key of ['primary', 'secondary', 'text', 'background'] as const) {
      const value = profile.brand[key];
      if (value !== undefined && !isHexColour(value)) add(`brand.${key}`, 'Use a colour like #0B1B3A');
    }
  }
  return issues;
}
