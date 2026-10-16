import { describe, expect, it } from 'vitest';
import { buildContractDocument, documentText } from './document';
import { formatCount, formatValue, unitWord } from './format';
import { LIBRARY } from './library';
import { CONTRACT_KINDS } from './model';
import { buildReviewSummary, reviewText } from './review';
import { makeContract } from './testing';
import { validateContract } from './validation';

const COUNTED = LIBRARY.variables.filter((def) => (def.type === 'integer' || def.type === 'number') && def.unit && def.unit !== 'percent');

describe('units read correctly for every count', () => {
  it('uses the singular for exactly one and the plural otherwise', () => {
    expect(formatCount(1, 'days')).toBe('1 day');
    expect(formatCount(2, 'days')).toBe('2 days');
    expect(formatCount(0, 'days')).toBe('0 days');
    expect(formatCount(1, 'rounds')).toBe('1 round');
    expect(formatCount(1.5, 'hours')).toBe('1.5 hours');
    expect(formatCount(30, 'percent')).toBe('30%');
    expect(unitWord(1, 'months')).toBe('month');
    expect(unitWord(12, 'months')).toBe('months');
  });

  it('never writes "1 days", "1 years" and the like for any numeric setting across its whole range', () => {
    const wrong = /\b1 (days|months|years|hours|rounds)\b/;
    for (const def of COUNTED) {
      const min = def.min ?? 1;
      const max = def.max ?? min + 5;
      for (const value of new Set([min, min + 1, 1, 2, max])) {
        if (def.type === 'integer' && !Number.isInteger(value)) continue;
        expect(formatValue(def, value), `${def.id}=${value}`).not.toMatch(wrong);
        expect(formatValue(def, value), `${def.id}=${value}`).toMatch(value === 1 ? /^1 \w+$/ : /s$/);
      }
    }
  });

  it('writes a valid, singular-correct agreement and review when every count is set to its minimum, to 1, and to its maximum', () => {
    for (const kind of CONTRACT_KINDS) {
      for (const pick of ['min', 'one', 'max'] as const) {
        const base = makeContract(kind);
        const variables = { ...base.variables };
        for (const def of COUNTED) {
          if (!def.kinds.includes(kind) || def.type !== 'integer') continue;
          const min = def.min ?? 1;
          variables[def.id] = pick === 'min' ? min : pick === 'one' ? 1 : (def.max ?? min);
        }
        // Switch every optional clause on so every setting is used.
        const clauseOverrides = Object.fromEntries(LIBRARY.clauses.filter((clause) => clause.kinds.includes(kind) && !clause.required).map((clause) => [clause.id, true]));
        const options = kind === 'services' ? { ...base.options, latePayment: 'interest', ipDuration: 'fixed-years', term: 'fixed', mediation: 'yes' } : { ...base.options };
        const contract = makeContract(kind, { variables, options, clauseOverrides });
        expect(validateContract(contract), `${kind} ${pick}`).toEqual([]);
        const text = `${documentText(buildContractDocument(contract))}\n${reviewText(buildReviewSummary(contract))}`;
        expect(text, `${kind} ${pick}`).not.toMatch(/\b1 (days|months|years|hours|rounds)\b/);
        expect(text, `${kind} ${pick}`).not.toMatch(/\b(undefined|NaN)\b/);
      }
    }
  });
});

describe('payment period and revision rounds', () => {
  const paymentDays = LIBRARY.variables.find((def) => def.id === 'paymentDays')!;
  const revisionRounds = LIBRARY.variables.find((def) => def.id === 'revisionRounds')!;

  it('asks for at least 1 day to pay and at most 60', () => {
    expect(paymentDays.min).toBe(1);
    expect(paymentDays.max).toBe(60);
    const base = makeContract('services').variables;
    expect(validateContract(makeContract('services', { variables: { ...base, paymentDays: 0 } })).map((issue) => issue.path)).toContain('variables.paymentDays');
    expect(validateContract(makeContract('services', { variables: { ...base, paymentDays: 61 } })).map((issue) => issue.path)).toContain('variables.paymentDays');
    expect(validateContract(makeContract('services', { variables: { ...base, paymentDays: 1 } }))).toEqual([]);
    expect(validateContract(makeContract('services', { variables: { ...base, paymentDays: 60 } }))).toEqual([]);
  });

  it('reads "within 1 day" for one day', () => {
    const doc = buildContractDocument(makeContract('services', { variables: { ...makeContract('services').variables, paymentDays: 1 } }));
    expect(documentText(doc)).toContain('pay each invoice within 1 day of receiving it');
  });

  it('says there are no included revision rounds when the number is 0, instead of "up to 0 rounds"', () => {
    const zero = documentText(buildContractDocument(makeContract('services', { variables: { ...makeContract('services').variables, revisionRounds: 0 } })));
    expect(zero).toContain('The fees include no rounds of revisions.');
    expect(zero).not.toMatch(/up to 0 rounds/);
    const one = documentText(buildContractDocument(makeContract('services', { variables: { ...makeContract('services').variables, revisionRounds: 1 } })));
    expect(one).toContain('The fees include up to 1 round of revisions');
    expect(one).not.toContain('no rounds of revisions');
    expect(revisionRounds.min).toBe(0);
  });
});
