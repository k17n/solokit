import { assertMinor, lineAmount, percentOf, roundToWhole, sum, type Minor } from '@solokit/core';
import { INDIA } from '../countries';
import type { TaxEngine } from '../types';
import { IN_RULES_AS_OF, isAllowedGstRate } from './rules';
import { isValidStateCode } from './states';

export type SellerGstStatus = 'regular' | 'composition' | 'unregistered';
export type GstDocumentType = 'tax-invoice' | 'bill-of-supply' | 'invoice';
export type SupplyMode = 'intra-state' | 'inter-state' | 'export-lut' | 'no-tax';

export type Discount = { kind: 'percent'; percent: number } | { kind: 'amount'; amount: Minor };

export interface GstLineInput {
  quantity: number;
  /** Rate per unit, in paise. */
  unitRate: Minor;
  discount?: Discount;
  /** GST rate in percent. Ignored for sellers who charge no tax; defaults to 0. */
  gstRate?: number;
}

export interface GstInput {
  sellerStatus: SellerGstStatus;
  /** GST state code, required for a regular seller making a domestic supply. */
  sellerStateCode?: string;
  /** GST state code of the place of supply, required for a regular seller making a domestic supply. */
  placeOfSupplyStateCode?: string;
  /** Export of goods/services, zero-rated under LUT. */
  isExport?: boolean;
  /** Registered seller supplying exempt goods/services: issues a bill of supply. */
  exemptSupply?: boolean;
  lines: GstLineInput[];
  /** Round the grand total to the nearest rupee. Defaults to true, except for export-lut where it defaults to false. */
  roundOff?: boolean;
  /** Reverse charge: tax is shown but paid by the recipient, so it is left out of the grand total. */
  reverseCharge?: boolean;
  /** Tax deducted at source by the client, as a percent of the value excluding GST. */
  tds?: { ratePercent: number };
  /** Advance already received against this invoice, in paise. */
  advanceReceived?: Minor;
}

export interface GstLineResult {
  gross: Minor;
  discount: Minor;
  taxable: Minor;
  /** The rate actually applied (0 when no tax is charged). */
  gstRate: number;
  cgst: Minor;
  sgst: Minor;
  igst: Minor;
  total: Minor;
}

export interface GstTotals {
  taxable: Minor;
  cgst: Minor;
  sgst: Minor;
  igst: Minor;
  totalTax: Minor;
  roundOff: Minor;
  grandTotal: Minor;
}

export interface GstResult {
  mode: SupplyMode;
  documentType: GstDocumentType;
  lines: GstLineResult[];
  totals: GstTotals;
  reverseCharge: boolean;
  /** TDS the client is expected to deduct. */
  tds: Minor;
  advance: Minor;
  /** grandTotal - tds - advance: what should actually arrive. */
  netPayable: Minor;
}

export class GstInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GstInputError';
  }
}

function resolveMode(input: GstInput): SupplyMode {
  if (input.sellerStatus !== 'regular' || input.exemptSupply) return 'no-tax';
  // isExport is ignored above for composition/unregistered sellers and exempt supplies: they charge no tax anyway.
  if (input.isExport) return 'export-lut';
  const seller = input.sellerStateCode;
  const supply = input.placeOfSupplyStateCode;
  if (!seller || !isValidStateCode(seller)) {
    throw new GstInputError('Seller state code is required and must be a valid GST state code');
  }
  if (!supply || !isValidStateCode(supply)) {
    throw new GstInputError('Place of supply is required and must be a valid GST state code');
  }
  return seller === supply ? 'intra-state' : 'inter-state';
}

function documentTypeFor(input: GstInput): GstDocumentType {
  if (input.sellerStatus === 'unregistered') return 'invoice';
  if (input.sellerStatus === 'composition' || input.exemptSupply) return 'bill-of-supply';
  return 'tax-invoice';
}

function discountFor(gross: Minor, discount: Discount | undefined): Minor {
  if (!discount) return 0;
  if (discount.kind === 'percent') {
    if (!Number.isFinite(discount.percent) || discount.percent < 0 || discount.percent > 100) {
      throw new GstInputError('Discount percent must be between 0 and 100');
    }
    return percentOf(gross, discount.percent);
  }
  assertMinor(discount.amount, 'discount amount');
  if (discount.amount < 0 || discount.amount > gross) {
    throw new GstInputError('Discount amount must be between 0 and the line amount');
  }
  return discount.amount;
}

function calculateLine(line: GstLineInput, mode: SupplyMode): GstLineResult {
  const taxed = mode === 'intra-state' || mode === 'inter-state';
  const gstRate = taxed ? (line.gstRate ?? 0) : 0;
  if (taxed && !isAllowedGstRate(gstRate)) {
    throw new GstInputError(`${gstRate}% is not a valid GST rate`);
  }
  if (line.unitRate < 0) {
    throw new GstInputError('Unit rate cannot be negative; issue a credit note instead');
  }
  const gross = lineAmount(line.quantity, line.unitRate);
  const discount = discountFor(gross, line.discount);
  const taxable = gross - discount;

  // Tax is computed per line, and CGST is rounded from the half-rate, so CGST + SGST can differ
  // from IGST on the same value by a paisa.
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (mode === 'intra-state') {
    cgst = percentOf(taxable, gstRate / 2);
    sgst = cgst;
  } else if (mode === 'inter-state') {
    igst = percentOf(taxable, gstRate);
  }
  return { gross, discount, taxable, gstRate, cgst, sgst, igst, total: taxable + cgst + sgst + igst };
}

function tdsFor(taxable: Minor, tds: GstInput['tds']): Minor {
  if (!tds) return 0;
  if (!Number.isFinite(tds.ratePercent) || tds.ratePercent < 0 || tds.ratePercent > 100) {
    throw new GstInputError('TDS rate must be between 0 and 100');
  }
  return percentOf(taxable, tds.ratePercent);
}

function advanceFor(grandTotal: Minor, tds: Minor, advance: Minor | undefined): Minor {
  if (advance === undefined) return 0;
  assertMinor(advance, 'advance');
  if (advance < 0 || advance > grandTotal - tds) {
    throw new GstInputError('Advance must be between 0 and the invoice total minus TDS, so the net payable is never negative');
  }
  return advance;
}

export function calculateGst(input: GstInput): GstResult {
  const mode = resolveMode(input);
  const lines = input.lines.map((line) => calculateLine(line, mode));

  const taxable = sum(lines.map((line) => line.taxable));
  const cgst = sum(lines.map((line) => line.cgst));
  const sgst = sum(lines.map((line) => line.sgst));
  const igst = sum(lines.map((line) => line.igst));
  const totalTax = cgst + sgst + igst;

  const reverseCharge = Boolean(input.reverseCharge) && (mode === 'intra-state' || mode === 'inter-state');
  const payableTax = reverseCharge ? 0 : totalTax;

  const beforeRounding = taxable + payableTax;
  const roundOff = (input.roundOff ?? mode !== 'export-lut') ? roundToWhole(beforeRounding) - beforeRounding : 0;
  const grandTotal = beforeRounding + roundOff;

  const tds = tdsFor(taxable, input.tds);
  const advance = advanceFor(grandTotal, tds, input.advanceReceived);

  return {
    mode,
    documentType: documentTypeFor(input),
    lines,
    totals: { taxable, cgst, sgst, igst, totalTax, roundOff, grandTotal },
    reverseCharge,
    tds,
    advance,
    netPayable: grandTotal - tds - advance,
  };
}

export const indiaGstEngine: TaxEngine<GstInput, GstResult> = {
  country: INDIA,
  rulesAsOf: IN_RULES_AS_OF,
  calculate: calculateGst,
};
