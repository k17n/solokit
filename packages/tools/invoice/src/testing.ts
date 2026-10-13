import type { Client, InvoiceRecord, SellerProfile } from './model';

// Valid GSTINs (checksums verified): Maharashtra 27AAPFU0939F1ZV, 27AABCT3518Q1ZW; Karnataka 29AAGCB7383J1Z4.

export function makeSeller(overrides: Partial<SellerProfile> = {}): SellerProfile {
  return {
    id: 'me',
    name: 'Asha Rao Consulting',
    gstStatus: 'regular',
    gstin: '27AAPFU0939F1ZV',
    pan: 'AAPFU0939F',
    address: { line1: '12 Linking Road', city: 'Mumbai', postalCode: '400050', stateCode: '27', country: 'India' },
    email: 'asha@example.com',
    upiId: 'asha@okhdfc',
    bank: {
      accountName: 'Asha Rao Consulting',
      accountNumber: '123456789012',
      ifsc: 'HDFC0001234',
      bankName: 'HDFC Bank',
      branch: 'Bandra West',
    },
    invoicePrefix: '',
    ...overrides,
  };
}

export function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    name: 'Northwind Traders',
    gstin: '27AABCT3518Q1ZW',
    address: { line1: '4 MG Road', city: 'Pune', postalCode: '411001', stateCode: '27', country: 'India' },
    email: 'accounts@northwind.example',
    ...overrides,
  };
}

/** One line: 24 hours at Rs 3,000 with 18% GST, Maharashtra to Maharashtra, issued 2026-10-14. */
export function makeInvoice(overrides: Partial<InvoiceRecord> = {}): InvoiceRecord {
  return {
    id: 'inv-1',
    number: '2026-27/0001',
    fiscalYear: '2026-27',
    kind: 'invoice',
    status: 'issued',
    issueDate: '2026-10-14',
    seller: makeSeller(),
    client: makeClient(),
    currency: 'INR',
    isExport: false,
    placeOfSupplyStateCode: '27',
    reverseCharge: false,
    exemptSupply: false,
    lines: [
      { id: 'l1', description: 'Consulting', code: '998312', quantity: 24, unit: 'hours', rate: 300000, gstRate: 18 },
    ],
    themeId: 'classic',
    createdAt: '2026-10-14T09:00:00.000Z',
    updatedAt: '2026-10-14T09:00:00.000Z',
    ...overrides,
  };
}
