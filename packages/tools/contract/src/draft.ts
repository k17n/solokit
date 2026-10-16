import { LIBRARY_VERSION } from './library';
import { PARTY_ROLES, type Contract, type ContractKind, type Party, type PartyAddress } from './model';

export interface DraftInput {
  id: string;
  kind: ContractKind;
  title?: string;
  /** YYYY-MM-DD. Defaults to today (UTC). */
  effectiveDate?: string;
  now?: Date;
  themeId?: string;
}

const blankAddress = (): PartyAddress => ({ line1: '', city: '', country: 'India' });

export function blankParty(role: Party['role']): Party {
  return { role, name: '', address: blankAddress(), email: '', signatoryName: '', signatoryTitle: '' };
}

/** A new, empty draft of the kind. Everything not set falls back to the template defaults when the document is built. */
export function createContractDraft(input: DraftInput): Contract {
  const now = input.now ?? new Date();
  const stamp = now.toISOString();
  const [first, second] = PARTY_ROLES[input.kind];
  return {
    id: input.id,
    kind: input.kind,
    title: input.title ?? '',
    status: 'draft',
    parties: [blankParty(first), blankParty(second)],
    effectiveDate: input.effectiveDate ?? stamp.slice(0, 10),
    variables: {},
    options: {},
    clauseOverrides: {},
    milestones: [],
    jurisdiction: { city: '', state: '' },
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    libraryVersion: LIBRARY_VERSION,
    ...(input.themeId ? { themeId: input.themeId } : {}),
  };
}

/** The shape of the invoice tool's seller profile and client, without depending on that package. */
export interface PartySource {
  name: string;
  address: { line1: string; line2?: string; city: string; postalCode?: string; country: string };
  email?: string;
  pan?: string;
  gstin?: string;
}

/** Fills a party from a saved profile or client. Signatory details are left for the user. */
export function partyFromProfile(role: Party['role'], source: PartySource): Party {
  const { address } = source;
  return {
    ...blankParty(role),
    name: source.name,
    address: {
      line1: address.line1,
      ...(address.line2 ? { line2: address.line2 } : {}),
      city: address.city,
      ...(address.postalCode ? { postalCode: address.postalCode } : {}),
      country: address.country,
    },
    email: source.email ?? '',
    ...(source.pan ? { pan: source.pan } : {}),
    ...(source.gstin ? { gstin: source.gstin } : {}),
  };
}
