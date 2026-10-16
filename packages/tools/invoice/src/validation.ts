import { MoneyError, indianFiscalYear, lineAmount } from '@solokit/core';
import { GstInputError, isAllowedGstRate, isValidStateCode, validateGstin } from '@solokit/tax-engines';
import { isBlank, validateProfile, type Issue } from '@solokit/profile';
import { isCurrencyCode } from './currencies';
import { calculateInvoiceGst } from './gst-input';
import type { Client, InvoiceRecord } from './model';

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVOICE_NUMBER = /^[A-Za-z0-9/-]{1,16}$/;

export function isRealIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const blank = isBlank;

export function validateClient(client: Client): Issue[] {
  const issues: Issue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  if (blank(client.name)) add('name', 'Enter the client name');
  if (blank(client.address.country)) add('address.country', 'Enter the client country');
  if (!blank(client.gstin)) {
    const result = validateGstin(client.gstin ?? '');
    if (!result.valid) add('gstin', result.reason);
  }
  if (!blank(client.pan) && !PAN.test(client.pan ?? '')) add('pan', 'PAN looks like ABCDE1234F');
  if (!blank(client.email) && !EMAIL.test(client.email ?? '')) add('email', 'Enter a valid email address');
  return issues;
}

export function validateInvoice(invoice: InvoiceRecord): Issue[] {
  const issues: Issue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  if (!INVOICE_NUMBER.test(invoice.number)) {
    add('number', 'Invoice numbers use up to 16 letters, digits, "/" or "-"');
  }
  if (!isRealIsoDate(invoice.issueDate)) add('issueDate', 'Enter a valid issue date');
  if (invoice.dueDate !== undefined) {
    if (!isRealIsoDate(invoice.dueDate)) add('dueDate', 'Enter a valid due date');
    else if (isRealIsoDate(invoice.issueDate) && invoice.dueDate < invoice.issueDate) {
      add('dueDate', 'The due date cannot be before the issue date');
    }
  }
  if (invoice.kind === 'quote') {
    if (invoice.dueDate !== undefined) add('dueDate', 'A quotation has a "valid until" date, not a due date');
    if (invoice.validUntil === undefined || blank(invoice.validUntil)) add('validUntil', 'Enter the date until which this quotation is valid');
    else if (!isRealIsoDate(invoice.validUntil)) add('validUntil', 'Enter a valid "valid until" date');
    else if (isRealIsoDate(invoice.issueDate) && invoice.validUntil < invoice.issueDate) {
      add('validUntil', 'The "valid until" date cannot be before the issue date');
    }
  }
  if (isRealIsoDate(invoice.issueDate) && invoice.fiscalYear !== indianFiscalYear(invoice.issueDate)) {
    add('fiscalYear', 'The financial year must match the issue date');
  }
  if (!isCurrencyCode(invoice.currency)) add('currency', 'Choose a supported currency');
  else if (!invoice.isExport && invoice.currency !== 'INR') {
    add('currency', 'Domestic invoices are issued in rupees (INR). Use another currency only for exports.');
  }

  for (const issue of validateProfile(invoice.seller)) add(`seller.${issue.path}`, issue.message);
  for (const issue of validateClient(invoice.client)) add(`client.${issue.path}`, issue.message);

  const taxed = invoice.seller.gstStatus === 'regular' && !invoice.isExport && !invoice.exemptSupply;
  if (taxed && (!invoice.placeOfSupplyStateCode || !isValidStateCode(invoice.placeOfSupplyStateCode))) {
    add('placeOfSupplyStateCode', 'Choose the place of supply');
  }

  if (invoice.lines.length === 0) add('lines', 'Add at least one line item');
  invoice.lines.forEach((line, index) => {
    const at = `lines[${index}]`;
    if (blank(line.description)) add(`${at}.description`, 'Describe what you are charging for');
    const quantityOk =
      Number.isFinite(line.quantity) &&
      line.quantity >= 0.001 &&
      Math.abs(line.quantity * 1000 - Math.round(line.quantity * 1000)) < 1e-9;
    const rateOk = Number.isSafeInteger(line.rate) && line.rate >= 0;
    if (!quantityOk) add(`${at}.quantity`, 'Quantity can have up to 3 decimals and must be at least 0.001');
    if (!rateOk) add(`${at}.rate`, 'Enter the rate as an amount of 0 or more');
    if (quantityOk && rateOk && line.quantity * line.rate > 1e13) add(at, 'This line is too large');
    if (taxed && line.gstRate === undefined) add(`${at}.gstRate`, 'Choose a GST rate');
    else if (taxed && line.gstRate !== undefined && !isAllowedGstRate(line.gstRate)) {
      add(`${at}.gstRate`, `${line.gstRate}% is not a GST rate`);
    }
    if (line.discount) {
      if (line.discount.kind === 'percent') {
        const { percent } = line.discount;
        if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
          add(`${at}.discount`, 'Enter a discount percentage between 0 and 100');
        }
      } else {
        const { amount } = line.discount;
        if (!Number.isSafeInteger(amount) || amount < 0) {
          add(`${at}.discount`, 'Enter the discount as an amount of 0 or more');
        } else if (quantityOk && rateOk && amount > lineAmount(line.quantity, line.rate)) {
          add(`${at}.discount`, 'The discount cannot be more than the line amount');
        }
      }
    }
  });

  if (invoice.tds && (!Number.isFinite(invoice.tds.ratePercent) || invoice.tds.ratePercent < 0 || invoice.tds.ratePercent > 100)) {
    add('tds.ratePercent', 'TDS rate must be between 0 and 100');
  }
  if (invoice.advanceReceived !== undefined && (!Number.isSafeInteger(invoice.advanceReceived) || invoice.advanceReceived < 0)) {
    add('advanceReceived', 'Advance must be 0 or more');
  }

  if (issues.length === 0) {
    try {
      const result = calculateInvoiceGst(invoice);
      if (result.netPayable < 0) {
        add('advanceReceived', 'TDS and the advance together are more than the invoice total');
      }
    } catch (error) {
      if (error instanceof MoneyError) {
        add('lines', 'The invoice total is too large to calculate');
      } else if (error instanceof GstInputError) {
        add(/advance/i.test(error.message) ? 'advanceReceived' : 'lines', error.message);
      } else {
        throw error;
      }
    }
  }
  return issues;
}
