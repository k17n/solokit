import { describe, expect, it } from 'vitest';
import { createContractDraft } from './draft';
import type { Contract } from './model';
import { makeContract, makeParty } from './testing';
import { validateContract } from './validation';

const paths = (contract: Contract) => validateContract(contract).map((issue) => issue.path);
const message = (contract: Contract, path: string) => validateContract(contract).find((issue) => issue.path === path)?.message;

describe('validateContract', () => {
  it('accepts a complete contract of each kind', () => {
    expect(validateContract(makeContract('nda-mutual'))).toEqual([]);
    expect(validateContract(makeContract('nda-one-way'))).toEqual([]);
    expect(validateContract(makeContract('services'))).toEqual([]);
  });

  it('reports every missing thing in a blank draft, each with its own field', () => {
    const found = paths(createContractDraft({ id: 'x', kind: 'services', effectiveDate: '2026-10-16' }));
    for (const expected of [
      'title',
      'parties.0.name',
      'parties.0.address.line1',
      'parties.0.address.city',
      'parties.0.email',
      'parties.0.signatoryName',
      'parties.0.signatoryTitle',
      'parties.1.name',
      'jurisdiction.city',
      'jurisdiction.state',
      'options.feeModel',
      'variables.servicesDescription',
      'variables.deliverables',
    ]) {
      expect(found, expected).toContain(expected);
    }
    // Things with defaults are not reported.
    expect(found).not.toContain('variables.paymentDays');
  });

  it('needs the NDA purpose', () => {
    const contract = makeContract('nda-one-way', { variables: {} });
    expect(message(contract, 'variables.purpose')).toBe('Fill in: Purpose of sharing the information');
  });

  it('checks the effective date', () => {
    expect(paths(makeContract('nda-mutual', { effectiveDate: '2026-02-30' }))).toContain('effectiveDate');
    expect(paths(makeContract('nda-mutual', { effectiveDate: '' }))).toContain('effectiveDate');
  });

  it('checks the term and survival numbers', () => {
    const base = makeContract('nda-mutual').variables;
    expect(paths(makeContract('nda-mutual', { variables: { ...base, termMonths: 0 } }))).toContain('variables.termMonths');
    expect(paths(makeContract('nda-mutual', { variables: { ...base, termMonths: 2.5 } }))).toContain('variables.termMonths');
    expect(paths(makeContract('nda-mutual', { variables: { ...base, confidentialityYears: 99 } }))).toContain('variables.confidentialityYears');
    expect(message(makeContract('nda-mutual', { variables: { ...base, confidentialityYears: 'three' } }), 'variables.confidentialityYears')).toMatch(/must be a number/);
    expect(paths(makeContract('nda-mutual', { variables: { ...base, termMonths: 24, confidentialityYears: 3 } }))).toEqual([]);
  });

  it('needs a city and a state from the list', () => {
    expect(paths(makeContract('nda-mutual', { jurisdiction: { city: '', state: 'Maharashtra' } }))).toEqual(['jurisdiction.city']);
    expect(paths(makeContract('nda-mutual', { jurisdiction: { city: 'Pune', state: 'Atlantis' } }))).toEqual(['jurisdiction.state']);
  });

  it('needs a fee model and scope text for a services agreement', () => {
    const base = makeContract('services');
    expect(paths({ ...base, options: {} })).toEqual(['options.feeModel']);
    expect(paths({ ...base, variables: { fixedFee: 1000 } })).toEqual(['variables.servicesDescription', 'variables.deliverables']);
    expect(paths({ ...base, variables: { ...base.variables, servicesDescription: '   ' } })).toEqual(['variables.servicesDescription']);
  });

  it('asks only for the amounts that go with the chosen fee model', () => {
    const base = makeContract('services');
    const noAmounts = { ...base, variables: { servicesDescription: 'x', deliverables: 'y' } };
    expect(paths({ ...noAmounts, options: { feeModel: 'fixed' } })).toEqual(['variables.fixedFee']);
    expect(paths({ ...noAmounts, options: { feeModel: 'hourly' } })).toEqual(['variables.hourlyRate']);
    expect(paths({ ...noAmounts, options: { feeModel: 'retainer' } })).toEqual(['variables.retainerFee']);
    expect(paths({ ...noAmounts, options: { feeModel: 'milestones' }, milestones: [] })).toEqual(['milestones']);
  });

  it('checks milestones', () => {
    const base = makeContract('services', { options: { feeModel: 'milestones' } });
    const bad = { ...base, milestones: [{ id: 'm', title: ' ', amount: 0, due: '' }] };
    expect(paths(bad)).toEqual(['milestones.0.title', 'milestones.0.amount', 'milestones.0.due']);
    expect(paths({ ...base, milestones: [{ id: 'm', title: 'x', amount: 10.123, due: 'now' }] })).toEqual(['milestones.0.amount']);
  });

  it('checks money and percent ranges', () => {
    const base = makeContract('services');
    expect(paths({ ...base, variables: { ...base.variables, fixedFee: -5 } })).toEqual(['variables.fixedFee']);
    expect(paths({ ...base, variables: { ...base.variables, fixedFee: 99.999 } })).toEqual(['variables.fixedFee']);
    expect(paths({ ...base, variables: { ...base.variables, advancePercent: 120 } })).toEqual(['variables.advancePercent']);
    expect(paths({ ...base, options: { feeModel: 'fixed', latePayment: 'interest' }, variables: { ...base.variables, lateInterestPercent: 40 } })).toEqual(['variables.lateInterestPercent']);
  });

  it('does not check values for options that are switched off', () => {
    const base = makeContract('services');
    expect(paths({ ...base, variables: { ...base.variables, lateInterestPercent: 400, ipYears: -1 } })).toEqual([]);
  });

  it('checks the end date of a fixed term', () => {
    const base = makeContract('services', { options: { feeModel: 'fixed', term: 'fixed' } });
    expect(paths({ ...base, variables: { ...base.variables, endDate: '2026-10-01' } })).toEqual(['variables.endDate']);
    expect(paths({ ...base, variables: { ...base.variables, endDate: 'tomorrow' } })).toEqual(['variables.endDate']);
    expect(paths(base)).toEqual([]);
  });

  it('checks parties: names differ, roles match, emails and ids look right', () => {
    const base = makeContract('services');
    const [first, second] = base.parties as [Contract['parties'][0], Contract['parties'][0]];
    expect(paths({ ...base, parties: [first, { ...second, name: first.name.toUpperCase() }] })).toEqual(['parties.1.name']);
    expect(paths({ ...base, parties: [{ ...first, role: 'client' }, second] })).toEqual(['parties.0.role']);
    expect(paths({ ...base, parties: [first] })).toEqual(['parties']);
    expect(paths({ ...base, parties: [{ ...first, email: 'nope' }, second] })).toEqual(['parties.0.email']);
    expect(paths({ ...base, parties: [{ ...first, pan: 'bad' }, second] })).toEqual(['parties.0.pan']);
    expect(paths({ ...base, parties: [{ ...first, gstin: '27AAPFU0939F1ZW' }, second] })).toEqual(['parties.0.gstin']);
    expect(paths({ ...base, parties: [{ ...first, gstin: '27AAPFU0939F1ZV' }, second] })).toEqual([]);
    expect(paths({ ...base, parties: [first, { ...second, cin: 'X1' }] })).toEqual(['parties.1.cin']);
    expect(paths({ ...base, parties: [first, makeParty({ role: 'client', name: 'B', cin: undefined })] })).toEqual([]);
  });

  it('does not let a required clause be removed, and flags unknown clauses', () => {
    const base = makeContract('services');
    expect(message({ ...base, clauseOverrides: { fees: false } }, 'clauseOverrides.fees')).toMatch(/required/);
    expect(paths({ ...base, clauseOverrides: { 'no-such-clause': true } })).toEqual(['clauseOverrides.no-such-clause']);
    expect(paths({ ...base, clauseOverrides: { indemnity: false, 'non-solicit': true } })).toEqual([]);
    // A services-only clause does not exist in an NDA.
    expect(paths({ ...makeContract('nda-mutual'), clauseOverrides: { indemnity: true } })).toEqual(['clauseOverrides.indemnity']);
  });

  it('flags an option value that is not one of the choices', () => {
    expect(paths(makeContract('services', { options: { feeModel: 'fixed', ip: 'sell' } }))).toEqual(['options.ip']);
  });

  it('flags text that is far too long', () => {
    const base = makeContract('services');
    expect(paths({ ...base, variables: { ...base.variables, servicesDescription: 'x'.repeat(5001) } })).toEqual(['variables.servicesDescription']);
  });

  it('returns a single issue for an unknown kind', () => {
    expect(validateContract({ ...makeContract('services'), kind: 'lease' as never })).toEqual([{ path: 'kind', message: 'Choose which kind of agreement this is' }]);
  });
});
