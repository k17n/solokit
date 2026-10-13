import { amountInWords } from '@solokit/core';
import { calculateGst, getStateByCode, type GstLineResult, type SupplyMode } from '@solokit/tax-engines';
import { formatAmount, type CurrencyCode } from './currencies';
import { buildDeclarations } from './declarations';
import type { Address, Client, InvoiceRecord, SellerProfile } from './model';
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
  number: string;
  issueDate: string;
  dueDate?: string;
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
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "2026-10-14" -> "14 Oct 2026". Pure string handling, so time zones cannot shift the day. */
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

function party(source: SellerProfile | Client): DocParty {
  const result: DocParty = { name: source.name, lines: addressLines(source.address) };
  if (source.gstin) result.gstin = source.gstin;
  if (source.pan) result.pan = source.pan;
  if (source.email) result.email = source.email;
  if (source.phone) result.phone = source.phone;
  return result;
}

function titleFor(invoice: InvoiceRecord, documentType: string): string {
  if (invoice.kind === 'proforma') return 'Proforma Invoice';
  if (documentType === 'tax-invoice') return 'Tax Invoice';
  if (documentType === 'bill-of-supply') return 'Bill of Supply';
  return 'Invoice';
}

export function buildInvoiceDocument(invoice: InvoiceRecord): InvoiceDocument {
  const money = (minor: number) => formatAmount(minor, invoice.currency);
  const taxLines: GstLineResult[] = [];

  const result = calculateGst({
    sellerStatus: invoice.seller.gstStatus,
    ...(invoice.seller.address.stateCode ? { sellerStateCode: invoice.seller.address.stateCode } : {}),
    ...(invoice.placeOfSupplyStateCode ? { placeOfSupplyStateCode: invoice.placeOfSupplyStateCode } : {}),
    isExport: invoice.isExport,
    exemptSupply: invoice.exemptSupply,
    reverseCharge: invoice.reverseCharge,
    lines: invoice.lines.map((line) => ({
      quantity: line.quantity,
      unitRate: line.rate,
      ...(line.discount ? { discount: line.discount } : {}),
      ...(line.gstRate !== undefined ? { gstRate: line.gstRate } : {}),
    })),
    ...(invoice.roundOff !== undefined ? { roundOff: invoice.roundOff } : {}),
    ...(invoice.tds ? { tds: invoice.tds } : {}),
    ...(invoice.advanceReceived !== undefined ? { advanceReceived: invoice.advanceReceived } : {}),
  });
  taxLines.push(...result.lines);

  const { mode, totals, reverseCharge } = result;
  const showTax = mode === 'intra-state' || mode === 'inter-state';
  const showCode = invoice.lines.some((line) => Boolean(line.code));
  const grossTotal = result.lines.reduce((sum, line) => sum + line.gross, 0);
  const discountTotal = result.lines.reduce((sum, line) => sum + line.discount, 0);
  const showDiscount = discountTotal > 0;

  const lines: DocLine[] = invoice.lines.map((line, index) => {
    const calculated = taxLines[index] as GstLineResult;
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
    else rows.push({ label: 'Taxable value', amount: money(totals.taxable) });
  }

  if (showTax) {
    const rates = [...new Set(taxLines.map((line) => line.gstRate))].sort((a, b) => b - a);
    const suffix = reverseCharge ? ' (reverse charge)' : '';
    const emphasis = reverseCharge ? ({ emphasis: 'muted' } as const) : {};
    for (const rate of rates) {
      const atRate = taxLines.filter((line) => line.gstRate === rate);
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
  rows.push({ label: 'Total', amount: money(totals.grandTotal), emphasis: 'total' });

  if (result.tds > 0) {
    rows.push({
      label: `TDS @${invoice.tds?.ratePercent ?? 0}% (deducted by client)`,
      amount: money(-result.tds),
      emphasis: 'muted',
    });
  }
  if (result.advance > 0) rows.push({ label: 'Advance received', amount: money(-result.advance), emphasis: 'muted' });
  if (result.tds > 0 || result.advance > 0) {
    rows.push({ label: 'Net payable', amount: money(result.netPayable), emphasis: 'net' });
  }

  const payment: InvoiceDocument['payment'] = {};
  const { bank } = invoice.seller;
  if (bank) {
    payment.bank = [
      { label: 'Account name', value: bank.accountName },
      { label: 'Account number', value: bank.accountNumber },
      { label: 'IFSC', value: bank.ifsc },
      { label: 'Bank', value: bank.branch ? `${bank.bankName}, ${bank.branch}` : bank.bankName },
    ];
  }
  if (invoice.currency === 'INR' && invoice.seller.upiId && result.netPayable > 0) {
    payment.upi = {
      id: invoice.seller.upiId,
      payload: buildUpiPayload({
        upiId: invoice.seller.upiId,
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
      ...(invoice.tds ? { tdsRatePercent: invoice.tds.ratePercent } : {}),
    }),
    payment,
  };
  if (invoice.dueDate) document.dueDate = formatDisplayDate(invoice.dueDate);
  if (placeOfSupply) document.placeOfSupply = placeOfSupply;
  if (invoice.notes) document.notes = invoice.notes;
  if (invoice.terms) document.terms = invoice.terms;
  if (invoice.seller.logoDataUrl) document.logoDataUrl = invoice.seller.logoDataUrl;
  return document;
}
