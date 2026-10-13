import type { SupplyMode } from '@solokit/tax-engines';
import type { SellerProfile } from './model';

export interface DeclarationInput {
  seller: SellerProfile;
  mode: SupplyMode;
  exemptSupply: boolean;
  reverseCharge: boolean;
  isProforma: boolean;
  tdsRatePercent?: number;
}

/** A TDS rate as printed on the invoice: at most two decimals, no trailing zeros. */
export function formatTdsRate(ratePercent: number): string {
  return String(Number(ratePercent.toFixed(2)));
}

/** The statements an Indian invoice has to carry for this kind of supply. */
export function buildDeclarations({
  seller,
  mode,
  exemptSupply,
  reverseCharge,
  isProforma,
  tdsRatePercent,
}: DeclarationInput): string[] {
  const lines: string[] = [];

  if (isProforma) lines.push('This is a proforma invoice. It is not a tax invoice.');

  if (seller.gstStatus === 'composition') {
    lines.push('Composition taxable person, not eligible to collect tax on supplies.');
  } else if (seller.gstStatus === 'regular' && exemptSupply && mode === 'no-tax') {
    lines.push('Exempt supply: no tax is charged on this bill of supply.');
  } else if (seller.gstStatus === 'unregistered' && seller.unregisteredNote !== false) {
    lines.push('Not registered under GST.');
  }

  if (mode === 'export-lut' && seller.gstStatus === 'regular') {
    const lut = seller.lutNumber ? `Letter of Undertaking (LUT No. ${seller.lutNumber})` : 'Letter of Undertaking (LUT)';
    lines.push(`Supply meant for export under ${lut} without payment of integrated tax.`);
  }

  if (reverseCharge && (mode === 'intra-state' || mode === 'inter-state')) lines.push('Tax on this supply is payable on reverse charge basis by the recipient.');

  if (tdsRatePercent !== undefined && Number.isFinite(tdsRatePercent) && tdsRatePercent > 0) {
    lines.push(`TDS at ${formatTdsRate(tdsRatePercent)}% is expected to be deducted by the client. Net payable is shown after this deduction.`);
  }
  return lines;
}
