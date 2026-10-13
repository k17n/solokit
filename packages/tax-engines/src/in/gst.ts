import { assertMinor, lineAmount, percentOf, roundToWhole, sum, type Minor } from '@solokit/core';
import { INDIA } from '../countries';
import type { TaxEngine } from '../types';
import { IN_RULES_AS_OF, isAllowedGstRate } from './rules';
import { isValidStateCode } from './states';

export type SellerGstStatus = 'regular' | 'composition' | 'unregistered';
export type DocumentType = 'tax-invoice' | 'bill-of-supply' | 'invoice';
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
  /** Round the grand total to the nearest rupee. Defaults to true. */
  roundOff?: boolean;
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
  documentType: DocumentType;
  lines: GstLineResult[];
  totals: GstTotals;
}

export class GstInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GstInputError';
  }
}

function resolveMode(input: GstInput): SupplyMode {
  if (input.sellerStatus !== 'regular' || input.exemptSupply) return 'no-tax';
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

function documentTypeFor(input: GstInput): DocumentType {
  if (input.sellerStatus === 'unregistered') return 'invoice';
  if (input.sellerStatus === 'composition' || input.exemptSupply) return 'bill-of-supply';
  return 'tax-invoice';
}

function discountFor(gross: Minor, discount: Discount | undefined): Minor {
  if (!discount) return 0;
  if (discount.kind === 'percent') {
    if (discount.percent < 0 || discount.percent > 100) {
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
  const gross = lineAmount(line.quantity, line.unitRate);
  const discount = discountFor(gross, line.discount);
  const taxable = gross - discount;

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

export function calculateGst(input: GstInput): GstResult {
  const mode = resolveMode(input);
  const lines = input.lines.map((line) => calculateLine(line, mode));

  const taxable = sum(lines.map((line) => line.taxable));
  const cgst = sum(lines.map((line) => line.cgst));
  const sgst = sum(lines.map((line) => line.sgst));
  const igst = sum(lines.map((line) => line.igst));
  const totalTax = cgst + sgst + igst;

  const beforeRounding = taxable + totalTax;
  const roundOff = (input.roundOff ?? true) ? roundToWhole(beforeRounding) - beforeRounding : 0;

  return {
    mode,
    documentType: documentTypeFor(input),
    lines,
    totals: { taxable, cgst, sgst, igst, totalTax, roundOff, grandTotal: beforeRounding + roundOff },
  };
}

export const indiaGstEngine: TaxEngine<GstInput, GstResult> = {
  country: INDIA,
  rulesAsOf: IN_RULES_AS_OF,
  calculate: calculateGst,
};
