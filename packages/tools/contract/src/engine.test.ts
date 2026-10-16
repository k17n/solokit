import { describe, expect, it } from 'vitest';
import { ContractRenderError, createContext, evalCondition, renderTemplate, tokensIn } from './engine';
import { formatCount, formatRupees, formatRupeesWithWords, tidyInline } from './format';
import type { ContractLibraryShape } from './library-types';
import { makeContract } from './testing';

const MINI: ContractLibraryShape = {
  version: 'test',
  clauses: [],
  variables: [
    { id: 'days', label: 'Days', help: '', type: 'integer', unit: 'days', default: 15, kinds: ['services'], clauseId: 'x' },
    { id: 'fee', label: 'Fee', help: '', type: 'money', kinds: ['services'], clauseId: 'x' },
    { id: 'note', label: 'Note', help: '', type: 'text', inline: true, kinds: ['services'], clauseId: 'x' },
    { id: 'when', label: 'When', help: '', type: 'date', kinds: ['services'], clauseId: 'x' },
  ],
  options: [
    {
      id: 'mode',
      label: 'Mode',
      help: '',
      kinds: ['services'],
      clauseId: 'x',
      default: 'one',
      choices: [
        { id: 'one', label: 'Option one', summary: 'one' },
        { id: 'two', label: 'Option two', summary: 'two' },
      ],
    },
  ],
  questions: [],
  assumptions: [],
  notes: [],
};

const ctx = (overrides: Parameters<typeof makeContract>[1] = {}) => createContext(makeContract('services', { variables: {}, ...overrides }), MINI);
const refs = new Map([
  ['pay', '4'],
  ['pay.late', '4.2'],
]);

describe('renderTemplate', () => {
  it('fills variables with their units, defaults and formats', () => {
    const context = ctx({ variables: { fee: 50000, note: 'a review. ', when: '2026-11-05' } });
    expect(renderTemplate('Pay {{fee}} within {{days}} for {{note}} by {{when}}.', context, refs)).toBe(
      'Pay INR 50,000 (Fifty Thousand Rupees Only) within 15 days for a review by 5 November 2026.',
    );
  });

  it('uses the singular for one', () => {
    expect(renderTemplate('{{days}}', ctx({ variables: { days: 1 } }), refs)).toBe('1 day');
  });

  it('fills party terms, names, date and place', () => {
    expect(renderTemplate('{{a}} / {{b}} / {{a.name}} / {{effectiveDate}} / {{city}}, {{state}}', ctx(), refs)).toBe(
      'Freelancer / Client / Asha Rao Consulting / 16 October 2026 / Mumbai, Maharashtra',
    );
  });

  it('prints the label of the chosen option', () => {
    expect(renderTemplate('{{mode}}', ctx({ options: { mode: 'two' } }), refs)).toBe('Option two');
    expect(renderTemplate('{{mode}}', ctx(), refs)).toBe('Option one');
  });

  it('resolves cross-references to clause and paragraph numbers', () => {
    expect(renderTemplate('see clause {{ref:pay}} and {{ref:pay.late}}', ctx(), refs)).toBe('see clause 4 and 4.2');
  });

  it('throws for a missing variable instead of leaving a blank', () => {
    expect.assertions(4);
    const run = () => renderTemplate('Pay {{fee}}', ctx(), refs);
    expect(run).toThrow(ContractRenderError);
    try {
      run();
    } catch (error) {
      expect((error as ContractRenderError).code).toBe('missing-variable');
      expect((error as ContractRenderError).token).toBe('fee');
      expect((error as Error).message).toContain('{{fee}}');
    }
  });

  it('treats a blank string or NaN as missing', () => {
    expect(() => renderTemplate('{{note}}', ctx({ variables: { note: '   ' } }), refs)).toThrow(/No value for \{\{note\}\}/);
    expect(() => renderTemplate('{{fee}}', ctx({ variables: { fee: Number.NaN } }), refs)).toThrow(ContractRenderError);
  });

  it('throws for an unknown token and for a reference to a clause that is not in the agreement', () => {
    expect(() => renderTemplate('{{nonsense}}', ctx(), refs)).toThrow(expect.objectContaining({ code: 'unknown-token' }));
    expect(() => renderTemplate('{{ref:gone}}', ctx(), refs)).toThrow(expect.objectContaining({ code: 'unknown-reference' }));
  });

  it('throws when the place of jurisdiction is missing', () => {
    expect(() => renderTemplate('{{city}}', ctx({ jurisdiction: { city: ' ', state: 'Goa' } }), refs)).toThrow(ContractRenderError);
  });
});

describe('tokensIn', () => {
  it('lists every token', () => {
    expect(tokensIn('a {{x}} b {{ ref:y.z }} {{x}}')).toEqual(['x', 'ref:y.z', 'x']);
  });
});

describe('evalCondition', () => {
  const context = ctx({ options: { mode: 'two' }, variables: { days: 20 } });
  it('tests options, numbers and inclusion', () => {
    expect(evalCondition({ option: 'mode', is: 'two' }, context)).toBe(true);
    expect(evalCondition({ option: 'mode', is: ['one', 'two'] }, context)).toBe(true);
    expect(evalCondition({ option: 'mode', is: 'one' }, context)).toBe(false);
    expect(evalCondition({ variable: 'days', gt: 15 }, context)).toBe(true);
    expect(evalCondition({ variable: 'days', eq: 20 }, context)).toBe(true);
    expect(evalCondition({ variable: 'fee', gt: 0 }, context)).toBe(false);
    expect(evalCondition({ not: { option: 'mode', is: 'one' } }, context)).toBe(true);
    expect(evalCondition({ all: [{ option: 'mode', is: 'two' }, { variable: 'days', gt: 99 }] }, context)).toBe(false);
    expect(evalCondition({ included: 'nothing' }, context)).toBe(false);
    expect(evalCondition(undefined, context)).toBe(true);
  });

  it('ignores an invalid stored choice and uses the default', () => {
    expect(createContext(makeContract('services', { options: { mode: 'bogus' } }), MINI).choices['mode']).toBe('one');
  });
});

describe('formatting', () => {
  it('writes rupees with Indian grouping', () => {
    expect(formatRupees(1250000)).toBe('INR 12,50,000');
    expect(formatRupees(1250.5)).toBe('INR 1,250.50');
    expect(formatRupeesWithWords(1000)).toBe('INR 1,000 (One Thousand Rupees Only)');
  });
  it('writes counts with units', () => {
    expect(formatCount(2, 'months')).toBe('2 months');
    expect(formatCount(1.5, 'percent')).toBe('1.5%');
    expect(formatCount(3, undefined)).toBe('3');
  });
  it('tidies inline text', () => {
    expect(tidyInline('  evaluating a project.;  ')).toBe('evaluating a project');
  });
});
