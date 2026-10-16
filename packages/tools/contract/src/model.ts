import type { StoredRecord } from '@solokit/storage';
import type { ContractDocument } from './document';
import type { ReviewSummary } from './review';

export const CONTRACT_KINDS = ['nda-mutual', 'nda-one-way', 'services'] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];
export type ContractStatus = 'draft' | 'final';

export const NDA_KINDS: readonly ContractKind[] = ['nda-mutual', 'nda-one-way'];
export const SERVICES_KINDS: readonly ContractKind[] = ['services'];

export type PartyRole = 'first' | 'second' | 'disclosing' | 'receiving' | 'freelancer' | 'client';

/** Both parties' roles by kind. The first role is the first party in the agreement. */
export const PARTY_ROLES: Record<ContractKind, readonly [PartyRole, PartyRole]> = {
  'nda-mutual': ['first', 'second'],
  'nda-one-way': ['disclosing', 'receiving'],
  services: ['freelancer', 'client'],
};

/** The defined term used for each role in the agreement text ("the Freelancer"). */
export const ROLE_LABELS: Record<PartyRole, string> = {
  first: 'First Party',
  second: 'Second Party',
  disclosing: 'Disclosing Party',
  receiving: 'Receiving Party',
  freelancer: 'Freelancer',
  client: 'Client',
};

export const KIND_LABELS: Record<ContractKind, string> = {
  'nda-mutual': 'Mutual NDA',
  'nda-one-way': 'One-way NDA',
  services: 'Freelance services agreement',
};

/** The heading printed on the agreement. */
export const KIND_HEADINGS: Record<ContractKind, string> = {
  'nda-mutual': 'Mutual Non-Disclosure Agreement',
  'nda-one-way': 'Non-Disclosure Agreement',
  services: 'Freelance Services Agreement',
};

export interface PartyAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface Party {
  role: PartyRole;
  name: string;
  address: PartyAddress;
  /** Used for notices. */
  email: string;
  signatoryName: string;
  signatoryTitle: string;
  pan?: string;
  gstin?: string;
  cin?: string;
}

export type VariableValue = string | number;

export interface Milestone {
  id: string;
  title: string;
  /** Rupees, up to two decimals. */
  amount: number;
  /** When it is due or what triggers it, in words ("on delivery of the first draft"). */
  due: string;
}

export interface Jurisdiction {
  city: string;
  /** One of the names in the stamp-duty list, for example "Maharashtra". */
  state: string;
}

export interface Contract extends StoredRecord {
  kind: ContractKind;
  /** Your own label, shown in lists and file names. The agreement's heading comes from the kind. */
  title: string;
  status: ContractStatus;
  /** Index 0 is the first role of the kind (for example the Freelancer), index 1 the second. */
  parties: Party[];
  /** YYYY-MM-DD */
  effectiveDate: string;
  placeOfSigning?: string;
  /** Typed values the user entered, by variable id. Anything missing falls back to the template default. */
  variables: Record<string, VariableValue>;
  /** Choices the user made, by option id. */
  options: Record<string, string>;
  /** Optional clauses switched on (true) or off (false), by clause id. */
  clauseOverrides: Record<string, boolean>;
  /** Used by the services agreement when the fee model is milestones. */
  milestones: Milestone[];
  jurisdiction: Jurisdiction;
  createdAt: string;
  updatedAt: string;
  themeId?: string;
  /** Counts saves of this record, starting at 1. */
  version: number;
  /** The exact wording at the moment the contract was finalised. Present only while the status is final. */
  finalDocument?: ContractDocument;
  /** The review summary written at the same moment, so the Review pack of a final agreement matches its frozen wording even after the template changes. */
  finalSummary?: ReviewSummary;
  /** The clause library this was written against, so a review can say which wording was used. */
  libraryVersion: string;
}
