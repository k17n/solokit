import { describe, expect, it } from 'vitest';
import { LIBRARY, createContractDraft, validateContract } from '@solokit/tool-contract';
import { makeContract } from '@solokit/tool-contract/testing';
import {
  byField,
  collectIssues,
  fieldGroups,
  fieldHint,
  fieldLabel,
  fillParty,
  optionalClauses,
  parseVariableText,
  setClauseIncluded,
  setOption,
  setVariable,
  suggestedTitle,
  updateParty,
} from './editorModel';

const draft = (kind: 'nda-mutual' | 'nda-one-way' | 'services') => createContractDraft({ id: 'c1', kind, now: new Date('2026-10-16T10:00:00Z'), effectiveDate: '2026-10-16' });
const def = (id: string) => LIBRARY.variables.find((variable) => variable.id === id)!;

describe('fieldGroups', () => {
  it('lists the fields of each clause in agreement order', () => {
    const groups = fieldGroups(draft('nda-mutual'));
    expect(groups.length).toBeGreaterThan(3);
    expect(groups.flatMap((group) => group.variables.map((variable) => variable.id))).toContain('purpose');
    expect(new Set(groups.map((group) => group.clauseId)).size).toBe(groups.length);
  });

  it('shows only the fee fields that belong to the chosen fee model', () => {
    const ids = (model: string) =>
      fieldGroups(setOption(draft('services'), 'feeModel', model))
        .flatMap((group) => group.variables)
        .map((variable) => variable.id);
    expect(ids('fixed')).toContain('fixedFee');
    expect(ids('fixed')).not.toContain('hourlyRate');
    expect(ids('hourly')).toContain('hourlyRate');
    expect(ids('hourly')).not.toContain('fixedFee');
    expect(ids('milestones')).not.toContain('fixedFee');
  });

  it('leaves out the fields of an optional clause that is switched off', () => {
    const clause = LIBRARY.clauses.find((candidate) => candidate.id === 'non-solicit')!;
    const on = fieldGroups(setClauseIncluded(draft('services'), clause, true)).flatMap((group) => group.variables.map((variable) => variable.id));
    const off = fieldGroups(setClauseIncluded(draft('services'), clause, false)).flatMap((group) => group.variables.map((variable) => variable.id));
    expect(on).toContain('nonSolicitMonths');
    expect(off).not.toContain('nonSolicitMonths');
  });

  it('never hides a field that validation can ask for, whichever optional clauses are off', () => {
    for (const kind of ['nda-mutual', 'nda-one-way', 'services'] as const) {
      for (const clause of optionalClauses(kind)) {
        const contract = setClauseIncluded(makeContract(kind), clause, !(clause.defaultIncluded ?? true));
        const shown = new Set(fieldGroups(contract).flatMap((group) => group.variables.map((variable) => `variables.${variable.id}`)));
        for (const issue of validateContract(contract)) {
          if (issue.path.startsWith('variables.')) expect(shown.has(issue.path), `${kind} ${clause.id} ${issue.path}`).toBe(true);
        }
      }
    }
  });
});

describe('number fields', () => {
  it('reads whole numbers, decimals and rupee amounts, and treats empty as the default', () => {
    expect(parseVariableText(def('termMonths'), ' 24 ')).toEqual({ ok: true, value: 24 });
    expect(parseVariableText(def('termMonths'), '')).toEqual({ ok: true, value: undefined });
    expect(parseVariableText(def('termMonths'), '2.5').ok).toBe(false);
    expect(parseVariableText(def('lateInterestPercent'), '1.5')).toEqual({ ok: true, value: 1.5 });
    expect(parseVariableText(def('fixedFee'), '1,20,000.50')).toEqual({ ok: true, value: 120000.5 });
    expect(parseVariableText(def('fixedFee'), '12.345').ok).toBe(false);
    expect(parseVariableText(def('fixedFee'), 'lots').ok).toBe(false);
  });

  it('adds the unit to the label once, and explains default and range in the hint', () => {
    expect(fieldLabel(def('termMonths'))).toBe('How long information can be shared (months)');
    expect(fieldLabel(def('fixedFee'))).toBe('Fixed fee (INR)');
    const hint = fieldHint(def('termMonths'), draft('nda-mutual'));
    expect(hint).toContain('template default: 24 months');
    expect(hint).toContain('Between 1 and 120 months');
  });
});

describe('editing helpers', () => {
  it('stores a clause switch only when it differs from the template', () => {
    const clause = optionalClauses('nda-mutual')[0]!;
    const base = draft('nda-mutual');
    const flipped = setClauseIncluded(base, clause, !(clause.defaultIncluded ?? true));
    expect(flipped.clauseOverrides).toEqual({ [clause.id]: !(clause.defaultIncluded ?? true) });
    expect(setClauseIncluded(flipped, clause, clause.defaultIncluded ?? true).clauseOverrides).toEqual({});
  });

  it('removes a variable when it is emptied', () => {
    const set = setVariable(draft('nda-mutual'), 'purpose', 'a pilot');
    expect(set.variables).toEqual({ purpose: 'a pilot' });
    expect(setVariable(set, 'purpose', undefined).variables).toEqual({});
  });

  it('fills a party from saved details but keeps the signatory already typed', () => {
    const typed = updateParty(draft('services'), 0, { signatoryName: 'Asha Rao', signatoryTitle: 'Proprietor' });
    const filled = fillParty(typed, 0, { name: 'Asha Rao Consulting', email: 'asha@example.com', address: { line1: '12 Linking Road', city: 'Mumbai', country: 'India', stateCode: '27' } });
    expect(filled.parties[0]).toMatchObject({ name: 'Asha Rao Consulting', email: 'asha@example.com', signatoryName: 'Asha Rao', signatoryTitle: 'Proprietor', role: 'freelancer' });
    expect(filled.parties[0]!.address).toMatchObject({ city: 'Mumbai', state: 'Maharashtra' });
    expect(filled.parties[1]).toEqual(typed.parties[1]);
  });

  it('suggests a name from the kind and the other party', () => {
    expect(suggestedTitle(draft('nda-mutual'))).toBe('Mutual NDA');
    expect(suggestedTitle(updateParty(draft('services'), 1, { name: 'Northwind' }))).toBe('Freelance services agreement with Northwind');
  });
});

describe('issues', () => {
  it('reports unreadable typed numbers first, then the library checks, one message per field', () => {
    const contract = makeContract('nda-mutual');
    const issues = collectIssues(contract, { termMonths: 'abc' });
    expect(issues[0]).toMatchObject({ path: 'variables.termMonths' });
    expect(byField(issues)['variables.termMonths']).toContain('whole number');
    expect(collectIssues(contract, {})).toEqual([]);
  });
});
