import type { BusinessProfile } from './model';

/** Tools that read the business profile. Add a tool here and give it an entry in {@link PROFILE_REQUIREMENTS}. */
export type ProfileToolId = 'invoice' | 'contract';

export type FieldNeed = 'required' | 'recommended';

export interface ProfileRequirement {
  /** Dotted path into the profile, for example "address.city". */
  path: string;
  /** What to call it when asking, for example "City". */
  label: string;
  need: FieldNeed;
  /** Only applies while the profile says so. `gst-registered`: the GST status is regular or composition. */
  when?: 'gst-registered';
  /** Why the tool wants it. Shown next to the question. */
  why: string;
}

/**
 * What each tool needs from the business profile, as data. A tool asks only for what is missing from this list, so a
 * person who only wants a contract is never asked for a GSTIN. Order is the order to ask in.
 */
export const PROFILE_REQUIREMENTS: Readonly<Record<ProfileToolId, readonly ProfileRequirement[]>> = {
  invoice: [
    { path: 'name', label: 'Business name', need: 'required', why: 'Printed as the seller on every invoice' },
    { path: 'gstStatus', label: 'GST status', need: 'required', why: 'Decides whether tax is charged' },
    { path: 'address.line1', label: 'Address', need: 'required', why: 'Printed as the seller address' },
    { path: 'address.city', label: 'City', need: 'required', why: 'Printed as the seller address' },
    { path: 'address.stateCode', label: 'State', need: 'required', when: 'gst-registered', why: 'Decides CGST/SGST or IGST' },
    { path: 'gstin', label: 'GSTIN', need: 'required', when: 'gst-registered', why: 'Required on a tax invoice' },
    { path: 'email', label: 'Email', need: 'recommended', why: 'Lets clients reach you' },
    { path: 'bank.accountNumber', label: 'Bank account', need: 'recommended', why: 'Shown as how to pay you' },
  ],
  contract: [
    { path: 'name', label: 'Business name', need: 'required', why: 'Named as a party to the agreement' },
    { path: 'address.line1', label: 'Address', need: 'required', why: 'Parties are identified by address' },
    { path: 'address.city', label: 'City', need: 'required', why: 'Parties are identified by address' },
    { path: 'address.country', label: 'Country', need: 'required', why: 'Parties are identified by address' },
    { path: 'email', label: 'Email', need: 'required', why: 'Where legal notices are sent' },
    { path: 'phone', label: 'Phone', need: 'recommended', why: 'An extra way to reach you' },
  ],
};

function valueAt(profile: BusinessProfile, path: string): unknown {
  let value: unknown = profile;
  for (const key of path.split('.')) {
    if (typeof value !== 'object' || value === null) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** The profile's value at a path. A GST status that is only a placeholder counts as not given. */
function answered(profile: BusinessProfile, path: string): unknown {
  return path === 'gstStatus' && profile.gstUnconfirmed === true ? undefined : valueAt(profile, path);
}

const isFilled = (value: unknown) => (typeof value === 'string' ? value.trim() !== '' : value !== undefined && value !== null);

export interface MissingFieldsOptions {
  /** Also list recommended fields. Default: required fields only. */
  includeRecommended?: boolean;
}

/**
 * The fields this tool needs that the profile does not have yet, in the order to ask. With no profile at all, every
 * unconditional field is missing; fields that depend on the GST status are left out until the status is known.
 */
export function missingFields(profile: BusinessProfile | undefined, toolId: ProfileToolId, options: MissingFieldsOptions = {}): ProfileRequirement[] {
  const registered = profile !== undefined && profile.gstUnconfirmed !== true && profile.gstStatus !== undefined && profile.gstStatus !== 'unregistered';
  return PROFILE_REQUIREMENTS[toolId].filter((requirement) => {
    if (requirement.need === 'recommended' && !options.includeRecommended) return false;
    if (requirement.when === 'gst-registered' && !registered) return false;
    return profile === undefined || !isFilled(answered(profile, requirement.path));
  });
}
