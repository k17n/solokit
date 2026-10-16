import { amountInWords } from '@solokit/core';
import { getStateByCode, type GstLineResult, type SupplyMode } from '@solokit/tax-engines';
import { formatAmount, type CurrencyCode } from './currencies';
import { buildDeclarations, formatTdsRate } from './declarations';
import { calculateInvoiceGst } from './gst-input';
import type { Address, BusinessProfile } from '@solokit/profile';
import type { Client, InvoiceKind, InvoiceRecord, InvoiceStatus } from './model';
import { buildUpiPayload } from './upi';
import { formatQuantity } from './units';

export interface DocParty {
  name: string;
  lines: string[];
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
}

export interface DocLine {
  number: number;
  description: string;
  code: string;
  quantity: string;
  rate: string;
  discount: string;
  taxable: string;
  taxRate: string;
  taxAmount: string;
  amount: string;
}

export interface DocTotalRow {
  label: string;
  amount: string;
  emphasis?: 'total' | 'net' | 'muted';
}

export interface InvoiceDocument {
  title: string;
  status: InvoiceStatus;
  kind: InvoiceKind;
  number: string;
  issueDate: string;
  dueDate?: string;
  /** Quotations only. */
  validUntil?: string;
  /** True for a quotation: amounts are estimates. */
  estimate: boolean;
  currency: CurrencyCode;
  mode: SupplyMode;
  showTax: boolean;
  showCode: boolean;
  showDiscount: boolean;
  seller: DocParty;
  client: DocParty;
  placeOfSupply?: string;
  lines: DocLine[];
  totals: DocTotalRow[];
  amountInWords: string;
  declarations: string[];
  notes?: string;
  terms?: string;
  payment: {
    bank?: { label: string; value: string }[];
    upi?: { id: string; payload: string };
  };
  logoDataUrl?: string;
  signatory: { forName: string; label: string };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * "2026-10-14" -> "14 Oct 2026". Pure string handling, so time zones cannot shift the day.
 * Expects a well-formed ISO date (YYYY-MM-DD); callers validate first.
 */
export function formatDisplayDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

function addressLines(address: Address): string[] {
  const lines = [address.line1];
  if (address.line2) lines.push(address.line2);
  lines.push(address.postalCode ? `${address.city} - ${address.postalCode}` : address.city);
  const state = address.stateCode ? getStateByCode(address.stateCode)?.name : undefined;
  if (state) lines.push(state);
  else if (address.country && address.country !== 'India') lines.push(address.country);
  return lines;
}

function party(source: BusinessProfile | Client): DocParty {
  const result: DocParty = { name: source.name, lines: addressLines(source.address) };
  if (source.gstin) result.gstin = source.gstin;
  if (source.pan) result.pan = source.pan;
  if (source.email) result.email = source.email;
  if (source.phone) result.phone = source.phone;
  return result;
}

function titleFor(invoice: InvoiceRecord, documentType: string): string {
  if (invoice.kind === 'quote') return 'Quotation';
  if (invoice.kind === 'proforma') return 'Proforma Invoice';
  if (documentType === 'tax-invoice') return 'Tax Invoice';
  if (documentType === 'bill-of-supply') return 'Bill of Supply';
  return 'Invoice';
}

export function buildInvoiceDocument(invoice: InvoiceRecord): InvoiceDocument {
  const estimate = invoice.kind === 'quote';
  const money = (minor: number) => formatAmount(minor, invoice.currency);

  const result = calculateInvoiceGst(invoice);
  if (result.lines.length !== invoice.lines.length) {
    throw new Error('Tax engine returned a different number of lines than the invoice');
  }

  const { mode, totals, reverseCharge } = result;
  const showTax = mode === 'intra-state' || mode === 'inter-state';
  const showCode = invoice.lines.some((line) => Boolean(line.code));
  const grossTotal = result.lines.reduce((sum, line) => sum + line.gross, 0);
  const discountTotal = result.lines.reduce((sum, line) => sum + line.discount, 0);
  const showDiscount = discountTotal > 0;

  const lines: DocLine[] = result.lines.map((calculated, index) => {
    const line = invoice.lines[index]!;
    const tax = calculated.cgst + calculated.sgst + calculated.igst;
    return {
      number: index + 1,
      description: line.description,
      code: line.code ?? '',
      quantity: formatQuantity(line.quantity, line.unit),
      rate: money(line.rate),
      discount: calculated.discount > 0 ? money(-calculated.discount) : '',
      taxable: money(calculated.taxable),
      taxRate: showTax ? `${calculated.gstRate}%` : '',
      taxAmount: showTax ? money(tax) : '',
      amount: money(reverseCharge ? calculated.taxable : calculated.total),
    };
  });

  const rows: DocTotalRow[] = [];
  if (showDiscount) {
    rows.push({ label: 'Subtotal', amount: money(grossTotal) });
    rows.push({ label: 'Discount', amount: money(-discountTotal) });
  }
  if (showTax) {
    rows.push({ label: 'Taxable value', amount: money(totals.taxable) });
  } else if (showDiscount || totals.roundOff !== 0) {
    if (!showDiscount) rows.push({ label: 'Subtotal', amount: money(totals.taxable) });
    else rows.push({ label: 'Net amount', amount: money(totals.taxable) });
  }

  if (showTax) {
    const rates = [...new Set(result.lines.map((line) => line.gstRate))]
      .filter((rate) => rate !== 0)
      .sort((a, b) => b - a);
    const suffix = reverseCharge ? ' (reverse charge)' : estimate ? ' (estimated)' : '';
    const emphasis = reverseCharge ? ({ emphasis: 'muted' } as const) : {};
    for (const rate of rates) {
      const atRate = result.lines.filter((line) => line.gstRate === rate);
      const sum = (pick: (line: GstLineResult) => number) => atRate.reduce((total, line) => total + pick(line), 0);
      if (mode === 'intra-state') {
        rows.push({ label: `CGST @${rate / 2}%${suffix}`, amount: money(sum((line) => line.cgst)), ...emphasis });
        rows.push({ label: `SGST @${rate / 2}%${suffix}`, amount: money(sum((line) => line.sgst)), ...emphasis });
      } else {
        rows.push({ label: `IGST @${rate}%${suffix}`, amount: money(sum((line) => line.igst)), ...emphasis });
      }
    }
  }

  if (totals.roundOff !== 0) rows.push({ label: 'Round off', amount: money(totals.roundOff) });
  rows.push({ label: estimate ? 'Estimated total' : 'Total', amount: money(totals.grandTotal), emphasis: 'total' });

  if (result.tds > 0) {
    rows.push({
      label: `TDS @${formatTdsRate(invoice.tds?.ratePercent ?? 0)}% (deducted by client)`,
      amount: money(-result.tds),
      emphasis: 'muted',
    });
  }
  if (result.advance > 0) rows.push({ label: 'Advance received', amount: money(-result.advance), emphasis: 'muted' });
  if (result.tds > 0 || result.advance > 0) {
    rows.push({ label: 'Net payable', amount: money(result.netPayable), emphasis: 'net' });
  }

  // A quotation asks for no payment, so it carries no bank details or UPI code.
  const payment: InvoiceDocument['payment'] = {};
  const { bank } = invoice.seller;
  if (bank && !estimate) {
    payment.bank = [
      { label: 'Account name', value: bank.accountName },
      { label: 'Account number', value: bank.accountNumber },
      { label: 'IFSC', value: bank.ifsc },
      { label: 'Bank', value: bank.branch ? `${bank.bankName}, ${bank.branch}` : bank.bankName },
    ];
  }
  const upiId = invoice.seller.upiId?.trim();
  if (!estimate && invoice.currency === 'INR' && upiId && result.netPayable > 0) {
    payment.upi = {
      id: upiId,
      payload: buildUpiPayload({
        upiId,
        payeeName: invoice.seller.name,
        amountMinor: result.netPayable,
        note: `Invoice ${invoice.number}`,
      }),
    };
  }

  let placeOfSupply: string | undefined;
  if (mode === 'export-lut') placeOfSupply = 'Outside India (export)';
  else if (showTax && invoice.placeOfSupplyStateCode) placeOfSupply = getStateByCode(invoice.placeOfSupplyStateCode)?.name;

  const document: InvoiceDocument = {
    title: titleFor(invoice, result.documentType),
    status: invoice.status,
    kind: invoice.kind,
    estimate,
    number: invoice.number,
    issueDate: formatDisplayDate(invoice.issueDate),
    currency: invoice.currency,
    mode,
    showTax,
    showCode,
    showDiscount,
    seller: party(invoice.seller),
    client: party(invoice.client),
    lines,
    totals: rows,
    amountInWords: amountInWords(totals.grandTotal, invoice.currency),
    declarations: buildDeclarations({
      seller: invoice.seller,
      mode,
      exemptSupply: invoice.exemptSupply,
      reverseCharge,
      isProforma: invoice.kind === 'proforma',
      isQuote: estimate,
      ...(invoice.tds && result.tds > 0 ? { tdsRatePercent: invoice.tds.ratePercent } : {}),
    }),
    payment,
    signatory: { forName: invoice.seller.name, label: 'Authorised signatory' },
  };
  if (invoice.dueDate && !estimate) document.dueDate = formatDisplayDate(invoice.dueDate);
  if (invoice.validUntil && estimate) document.validUntil = formatDisplayDate(invoice.validUntil);
  if (placeOfSupply) document.placeOfSupply = placeOfSupply;
  if (invoice.notes) document.notes = invoice.notes;
  if (invoice.terms) document.terms = invoice.terms;
  if (invoice.seller.logoDataUrl) document.logoDataUrl = invoice.seller.logoDataUrl;
  return document;
}
