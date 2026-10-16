import { describe, expect, it } from 'vitest';
import { LIBRARY, buildContractDocument, buildReviewSummary, createContractDraft } from '@solokit/tool-contract';
import { makeContract } from '@solokit/tool-contract/testing';
import { chooseSide, fieldHint, safeSummary, swapParties, updateParty } from './editorModel';

const draft = (kind: 'nda-mutual' | 'nda-one-way' | 'services') => createContractDraft({ id: 'c1', kind, now: new Date('2026-10-16T10:00:00Z'), effectiveDate: '2026-10-16' });
const source = { name: 'Asha Rao Consulting', address: { line1: '12 Linking Road', city: 'Mumbai', country: 'India' }, email: 'asha@example.com', pan: 'AAPFU0939F' };

describe('chooseSide (which side are you?)', () => {
  it('puts the profile on the disclosing side when you say you disclose', () => {
    const next = chooseSide(draft('nda-one-way'), 0, source);
    expect(next.parties.map((party) => [party.role, party.name])).toEqual([['disclosing', 'Asha Rao Consulting'], ['receiving', '']]);
  });

  it('puts the profile on the receiving side when you say you receive', () => {
    const next = chooseSide(draft('nda-one-way'), 1, source);
    expect(next.parties.map((party) => [party.role, party.name])).toEqual([['disclosing', ''], ['receiving', 'Asha Rao Consulting']]);
  });

  it('moves the profile, and the signatory typed for it, when you change your mind', () => {
    let contract = chooseSide(draft('nda-one-way'), 0, source);
    contract = updateParty(contract, 0, { signatoryName: 'Asha Rao', signatoryTitle: 'Proprietor' });
    contract = updateParty(contract, 1, { name: 'Northwind Traders' });
    const moved = chooseSide(contract, 1, source);
    expect(moved.parties[1]).toMatchObject({ role: 'receiving', name: 'Asha Rao Consulting', signatoryName: 'Asha Rao', signatoryTitle: 'Proprietor' });
    // The side it came from is emptied, and the other business typed there is not touched by this: it was on the target side.
    expect(moved.parties[0]).toMatchObject({ role: 'disclosing', name: '', signatoryName: '' });
  });

  it('never wipes a different business the person typed on the other side', () => {
    const contract = updateParty(draft('nda-one-way'), 1, { name: 'Northwind Traders', signatoryName: 'Ravi' });
    const next = chooseSide(contract, 0, source);
    expect(next.parties[1]).toMatchObject({ name: 'Northwind Traders', signatoryName: 'Ravi' });
  });
});

describe('swapParties', () => {
  it.each(['nda-mutual', 'nda-one-way', 'services'] as const)('swaps the details of the two sides of a %s and keeps each place\'s role', (kind) => {
    const contract = makeContract(kind);
    const [a, b] = contract.parties;
    const swapped = swapParties(contract);
    expect(swapped.parties.map((party) => party.role)).toEqual(contract.parties.map((party) => party.role));
    expect(swapped.parties[0]).toMatchObject({ name: b!.name, email: b!.email, signatoryName: b!.signatoryName });
    expect(swapped.parties[1]).toMatchObject({ name: a!.name, email: a!.email, signatoryName: a!.signatoryName });
    expect(swapParties(swapped).parties).toEqual(contract.parties);
  });

  it('keeps the agreement valid and puts the names in the right defined terms', () => {
    const swapped = swapParties(makeContract('nda-one-way'));
    expect(swapped.parties[0]!.role).toBe('disclosing');
    expect(swapped.parties[0]!.name).toBe('Northwind Traders Private Limited');
  });
});

describe('hints read correctly for a count of one', () => {
  const def = (id: string) => LIBRARY.variables.find((variable) => variable.id === id)!;
  it('says "At least 1 day" style units with the number they follow', () => {
    for (const variable of LIBRARY.variables) {
      if (variable.unit === undefined || variable.unit === 'percent' || (variable.type !== 'integer' && variable.type !== 'number')) continue;
      const hint = fieldHint(variable, draft('services'));
      expect(hint, variable.id).not.toMatch(/\b1 (days|months|years|hours|rounds)\b/);
      expect(hint, variable.id).not.toMatch(/\b(At least|At most|Between) [^.]*\b(and )?[2-9]\d* (day|month|year|hour|round)\./);
    }
  });
  it('writes the range of the payment period as 1 to 60 days', () => {
    expect(fieldHint(def('paymentDays'), draft('services'))).toContain('Between 1 and 60 days.');
  });
  it('writes a lone minimum of one in the singular', () => {
    expect(fieldHint({ ...def('paymentDays'), max: undefined }, draft('services'))).toContain('At least 1 day.');
    expect(fieldHint({ ...def('paymentDays'), min: 2, max: undefined }, draft('services'))).toContain('At least 2 days.');
  });
});

describe('safeSummary of a final agreement', () => {
  it('uses the summary frozen with the wording, and builds one from the current template for a draft', () => {
    const contract = makeContract('nda-mutual');
    const final = { ...contract, status: 'final' as const, finalDocument: buildContractDocument(contract), finalSummary: { ...buildReviewSummary(contract), contractTitle: 'Frozen title' } };
    expect(safeSummary(final)!.contractTitle).toBe('Frozen title');
    expect(safeSummary(contract)!.contractTitle).toBe('Sample nda-mutual');
    expect(safeSummary(null)).toBeNull();
  });
});
