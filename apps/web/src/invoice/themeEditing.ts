import type { InvoiceRecord } from '@solokit/tool-invoice';
import type { BusinessProfile } from '@solokit/profile';
import { fiscalYearOf } from './editorModel';

export { normaliseHex } from '@solokit/profile';

/** The wanted name, or the name with the first free number after it. Names are compared ignoring case. */
export function uniqueThemeName(wanted: string, taken: readonly string[]): string {
  const used = new Set(taken.map((name) => name.trim().toLowerCase()));
  if (!used.has(wanted.trim().toLowerCase())) return wanted;
  for (let n = 2; ; n++) {
    const candidate = `${wanted} ${n}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

/** A made-up invoice from the user's own seller details, so a theme can be judged on something that looks real. */
export function sampleInvoice(seller: BusinessProfile, themeId: string, today: string): InvoiceRecord {
  const stateCode = seller.address.stateCode ?? '27';
  const fiscalYear = fiscalYearOf(today) ?? '2026-27';
  const stamp = `${today}T09:00:00.000Z`;
  return {
    id: 'sample',
    number: `${fiscalYear}/0001`,
    fiscalYear,
    kind: 'invoice',
    status: 'issued',
    issueDate: today,
    seller,
    client: {
      id: 'sample-client',
      name: 'Sample Client Pvt Ltd',
      address: { line1: '4 MG Road', city: 'Pune', postalCode: '411001', stateCode, country: 'India' },
    },
    currency: 'INR',
    isExport: false,
    placeOfSupplyStateCode: stateCode,
    reverseCharge: false,
    exemptSupply: false,
    lines: [
      { id: 's1', description: 'Consulting services', code: '998311', quantity: 24, unit: 'hours', rate: 300000, gstRate: 18 },
      { id: 's2', description: 'Project report', code: '998311', quantity: 1, unit: 'fixed', rate: 1500000, gstRate: 18 },
    ],
    notes: 'This is a sample invoice for previewing your theme.',
    themeId,
    createdAt: stamp,
    updatedAt: stamp,
  };
}
