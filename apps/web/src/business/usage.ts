import { PROFILE_REQUIREMENTS, type ProfileToolId } from '@solokit/profile';

export const TOOL_LABELS: Readonly<Record<ProfileToolId, string>> = { invoice: 'Invoices and quotes', contract: 'Contracts' };

export type BusinessSection = 'details' | 'logo' | 'payments' | 'defaults';

/** Profile fields each section of the Business page holds. Paths are dotted, like `PROFILE_REQUIREMENTS`. */
const SECTION_FIELDS: Readonly<Record<BusinessSection, readonly string[]>> = {
  details: ['name', 'gstStatus', 'gstin', 'pan', 'udyam', 'address.line1', 'address.line2', 'address.city', 'address.postalCode', 'address.stateCode', 'address.country', 'email', 'phone', 'website'],
  logo: ['logoDataUrl', 'brand'],
  payments: ['bank.accountNumber', 'upiId'],
  defaults: ['invoicePrefix', 'lutNumber', 'defaultNotes', 'defaultTerms'],
};

/**
 * Uses that `PROFILE_REQUIREMENTS` does not cover because the field is optional for the tool: the contract tool fills
 * its party details from the PAN and GSTIN too, and the brand colours reach every export through the default theme.
 */
const OTHER_USES: Readonly<Record<string, readonly ProfileToolId[]>> = {
  pan: ['invoice', 'contract'],
  gstin: ['invoice', 'contract'],
  udyam: ['invoice'],
  phone: ['invoice', 'contract'],
  website: ['invoice'],
  logoDataUrl: ['invoice'],
  brand: ['invoice', 'contract'],
  'bank.accountNumber': ['invoice'],
  upiId: ['invoice'],
  invoicePrefix: ['invoice'],
  lutNumber: ['invoice'],
  defaultNotes: ['invoice'],
  defaultTerms: ['invoice'],
};

/** The tools that read anything in this section, in the registry's order. */
export function toolsUsing(section: BusinessSection): ProfileToolId[] {
  const paths = SECTION_FIELDS[section];
  return (Object.keys(PROFILE_REQUIREMENTS) as ProfileToolId[]).filter(
    (tool) => PROFILE_REQUIREMENTS[tool].some((requirement) => paths.includes(requirement.path)) || paths.some((path) => OTHER_USES[path]?.includes(tool)),
  );
}
