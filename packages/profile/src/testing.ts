import type { BusinessProfile } from './model';

// Valid GSTINs (checksums verified): Maharashtra 27AAPFU0939F1ZV, 27AABCT3518Q1ZW; Karnataka 29AAGCB7383J1Z4.

export function makeProfile(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
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
