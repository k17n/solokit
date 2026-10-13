import { amountInWords, formatMoney, parseMoney } from '@solokit/core';
import { calculateGst } from '@solokit/tax-engines';

export interface DemoRow {
  label: string;
  amount: string;
}

export interface DemoResult {
  taxable: string;
  taxRows: DemoRow[];
  total: string;
  words: string;
}

const SELLER_STATE = '27'; // Maharashtra
const OTHER_STATE = '29'; // Karnataka
const MAX_AMOUNT = 100 * 10_000_000 * 100; // Rs 100 crore, in paise

/** A sample 18% GST invoice line for the home page. Uses the real calculation engine. */
export function computeDemo(input: string, sameState: boolean): DemoResult | null {
  const taxable = parseMoney(input);
  if (taxable === null || taxable <= 0 || taxable > MAX_AMOUNT) return null;

  const result = calculateGst({
    sellerStatus: 'regular',
    sellerStateCode: SELLER_STATE,
    placeOfSupplyStateCode: sameState ? SELLER_STATE : OTHER_STATE,
    lines: [{ quantity: 1, unitRate: taxable, gstRate: 18 }],
    roundOff: true,
  });

  const { cgst, sgst, igst, roundOff, grandTotal } = result.totals;
  const taxRows: DemoRow[] = sameState
    ? [
        { label: 'CGST 9%', amount: formatMoney(cgst) },
        { label: 'SGST 9%', amount: formatMoney(sgst) },
      ]
    : [{ label: 'IGST 18%', amount: formatMoney(igst) }];
  if (roundOff !== 0) taxRows.push({ label: 'Round off', amount: formatMoney(roundOff) });

  return {
    taxable: formatMoney(taxable),
    taxRows,
    total: formatMoney(grandTotal),
    words: amountInWords(grandTotal),
  };
}
