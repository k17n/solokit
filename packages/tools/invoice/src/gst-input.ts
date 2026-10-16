import { calculateGst, type GstResult } from '@solokit/tax-engines';
import type { InvoiceRecord } from './model';

/** Runs the GST engine on an invoice. Shared by validation and the document builder. */
export function calculateInvoiceGst(invoice: InvoiceRecord): GstResult {
  // A quote is only an estimate: nothing is deducted, paid in advance or reverse-charged on it.
  const estimate = invoice.kind === 'quote';
  const reverseCharge = invoice.reverseCharge && !estimate;
  const tds = estimate ? undefined : invoice.tds;
  const advance = estimate ? undefined : invoice.advanceReceived;
  return calculateGst({
    sellerStatus: invoice.seller.gstStatus,
    ...(invoice.seller.address.stateCode ? { sellerStateCode: invoice.seller.address.stateCode } : {}),
    ...(invoice.placeOfSupplyStateCode ? { placeOfSupplyStateCode: invoice.placeOfSupplyStateCode } : {}),
    isExport: invoice.isExport,
    exemptSupply: invoice.exemptSupply,
    reverseCharge,
    lines: invoice.lines.map((line) => ({
      quantity: line.quantity,
      unitRate: line.rate,
      ...(line.discount ? { discount: line.discount } : {}),
      ...(line.gstRate !== undefined ? { gstRate: line.gstRate } : {}),
    })),
    roundOff: invoice.roundOff ?? (invoice.currency === 'INR' && !invoice.isExport),
    ...(tds ? { tds } : {}),
    ...(advance !== undefined ? { advanceReceived: advance } : {}),
  });
}
