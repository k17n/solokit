import { calculateGst, type GstResult } from '@solokit/tax-engines';
import type { InvoiceRecord } from './model';

/** Runs the GST engine on an invoice. Shared by validation and the document builder. */
export function calculateInvoiceGst(invoice: InvoiceRecord): GstResult {
  return calculateGst({
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
    roundOff: invoice.roundOff ?? (invoice.currency === 'INR' && !invoice.isExport),
    ...(invoice.tds ? { tds: invoice.tds } : {}),
    ...(invoice.advanceReceived !== undefined ? { advanceReceived: invoice.advanceReceived } : {}),
  });
}
