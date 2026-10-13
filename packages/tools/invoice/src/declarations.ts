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
  } else if (seller.gstStatus === 'regular' && exemptSupply) {
    lines.push('Exempt supply: no tax is charged on this bill of supply.');
  } else if (seller.gstStatus === 'unregistered' && seller.unregisteredNote !== false) {
    lines.push('Not registered under GST.');
  }

  if (mode === 'export-lut') {
    const lut = seller.lutNumber ? `Letter of Undertaking (LUT No. ${seller.lutNumber})` : 'Letter of Undertaking (LUT)';
    lines.push(`Supply meant for export under ${lut} without payment of integrated tax.`);
  }

  if (reverseCharge) lines.push('Tax on this supply is payable on reverse charge basis by the recipient.');

  if (tdsRatePercent !== undefined && tdsRatePercent > 0) {
    lines.push(`TDS at ${tdsRatePercent}% is expected to be deducted by the client. Net payable is shown after this deduction.`);
  }
  return lines;
}
