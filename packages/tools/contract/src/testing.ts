import { createContractDraft } from './draft';
import { PARTY_ROLES, type Contract, type ContractKind, type Party } from './model';

export function makeParty(overrides: Partial<Party> = {}): Party {
  return {
    role: 'freelancer',
    name: 'Asha Rao Consulting',
    address: { line1: '12 Linking Road', city: 'Mumbai', state: 'Maharashtra', postalCode: '400050', country: 'India' },
    email: 'asha@example.com',
    signatoryName: 'Asha Rao',
    signatoryTitle: 'Proprietor',
    pan: 'AAPFU0939F',
    ...overrides,
  };
}

const CLIENT = (role: Party['role']): Party =>
  makeParty({
    role,
    name: 'Northwind Traders Private Limited',
    address: { line1: '4 MG Road', city: 'Pune', state: 'Maharashtra', postalCode: '411001', country: 'India' },
    email: 'legal@northwind.example',
    signatoryName: 'Ravi Menon',
    signatoryTitle: 'Director',
    pan: undefined as unknown as string,
    cin: 'U12345MH2020PTC123456',
  });

const withoutUndefined = <T extends object>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A complete, valid contract of the kind, written 2026-10-16 in Mumbai. */
export function makeContract(kind: ContractKind = 'services', overrides: Partial<Contract> = {}): Contract {
  const [first, second] = PARTY_ROLES[kind];
  const draft = createContractDraft({ id: `contract-${kind}`, kind, title: `Sample ${kind}`, effectiveDate: '2026-10-16', now: new Date('2026-10-16T10:00:00.000Z') });
  const base: Contract = {
    ...draft,
    parties: [withoutUndefined(makeParty({ role: first })), withoutUndefined(CLIENT(second))],
    jurisdiction: { city: 'Mumbai', state: 'Maharashtra' },
  };
  if (kind === 'services') {
    base.variables = {
      servicesDescription: 'Design a five-page marketing website\nSet up the contact form',
      deliverables: 'Figma design files\nResponsive HTML and CSS',
    };
    base.options = { feeModel: 'fixed' };
    // Values for every fee model, so a test can switch the model without filling anything in.
    base.variables['fixedFee'] = 120000;
    base.variables['hourlyRate'] = 1500;
    base.variables['retainerFee'] = 40000;
    base.variables['endDate'] = '2027-03-31';
    base.milestones = [
      { id: 'm1', title: 'Design approved', amount: 40000, due: 'on approval of the designs' },
      { id: 'm2', title: 'Site live', amount: 80000, due: 'on launch' },
    ];
  } else {
    base.variables = { purpose: 'evaluating a possible website redesign project' };
  }
  return { ...base, ...overrides };
}
