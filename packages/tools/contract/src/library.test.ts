import { describe, expect, it } from 'vitest';
import { tokensIn } from './engine';
import { LIBRARY } from './library';
import type { Clause, Condition } from './library-types';
import { CONTRACT_KINDS, type ContractKind } from './model';

const clausesFor = (kind: ContractKind): Clause[] => LIBRARY.clauses.filter((clause) => clause.kinds.includes(kind));
const KNOWN_FIXED = new Set(['a', 'b', 'a.name', 'b.name', 'effectiveDate', 'city', 'state']);

function templatesOf(clause: Clause): string[] {
  return clause.paragraphs.flatMap((paragraph) => [paragraph.text, ...(paragraph.items ?? []).map((item) => item.text)]);
}

function conditionsOf(condition: Condition | undefined): Condition[] {
  if (!condition) return [];
  if ('not' in condition) return [condition, ...conditionsOf(condition.not)];
  if ('all' in condition) return [condition, ...condition.all.flatMap(conditionsOf)];
  return [condition];
}

describe('clause library integrity', () => {
  it('has a version', () => {
    expect(LIBRARY.version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  it('gives every clause an id, title, explanation, rationale and a lawyer note', () => {
    for (const clause of LIBRARY.clauses) {
      expect(clause.id, clause.title).toMatch(/^[a-z-]+$/);
      expect(clause.title.length, clause.id).toBeGreaterThan(3);
      expect(clause.explanation.length, `${clause.id} explanation`).toBeGreaterThan(40);
      expect(clause.rationale.length, `${clause.id} rationale`).toBeGreaterThan(40);
      expect(clause.risk, `${clause.id} risk`).toMatch(/^Check with a lawyer/);
      expect(clause.paragraphs.length, clause.id).toBeGreaterThan(0);
    }
  });

  it('has unique clause ids within each kind', () => {
    for (const kind of CONTRACT_KINDS) {
      const ids = clausesFor(kind).map((clause) => clause.id);
      expect(new Set(ids).size, kind).toBe(ids.length);
    }
  });

  it('covers the clauses the product plan requires', () => {
    const nda = clausesFor('nda-mutual').map((clause) => clause.id);
    for (const id of ['definitions', 'purpose', 'obligations', 'permitted-disclosures', 'compelled-disclosure', 'term', 'return-destruction', 'no-licence', 'no-warranty', 'remedies', 'disputes', 'notices', 'entire-agreement', 'amendments', 'severability', 'counterparts']) {
      expect(nda, id).toContain(id);
    }
    const services = clausesFor('services').map((clause) => clause.id);
    for (const id of ['services', 'deliverables', 'fees', 'expenses', 'changes', 'client-responsibilities', 'ip', 'confidentiality', 'contractor', 'term', 'warranties', 'liability', 'indemnity', 'non-solicit', 'force-majeure', 'disputes', 'notices', 'entire-agreement', 'amendments', 'counterparts', 'stamp-duty']) {
      expect(services, id).toContain(id);
    }
  });

  it('shares the same NDA clauses between the mutual and one-way kinds', () => {
    expect(clausesFor('nda-mutual').map((clause) => clause.id)).toEqual(clausesFor('nda-one-way').map((clause) => clause.id));
  });

  it('keeps every variable and option id unique and attached to a real clause', () => {
    const ids = [...LIBRARY.variables.map((def) => def.id), ...LIBRARY.options.map((def) => def.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const def of [...LIBRARY.variables, ...LIBRARY.options]) {
      for (const kind of def.kinds) {
        const owner = 'clauseIdByKind' in def ? (def.clauseIdByKind?.[kind] ?? def.clauseId) : def.clauseId;
        expect(clausesFor(kind).map((clause) => clause.id), `${def.id} for ${kind}`).toContain(owner);
      }
      expect(def.label.length).toBeGreaterThan(2);
      expect(def.help.length, def.id).toBeGreaterThan(10);
    }
  });

  it('uses only tokens that exist for the kinds the text applies to', () => {
    for (const kind of CONTRACT_KINDS) {
      const variableIds = new Set(LIBRARY.variables.filter((def) => def.kinds.includes(kind)).map((def) => def.id));
      const optionIds = new Set(LIBRARY.options.filter((def) => def.kinds.includes(kind)).map((def) => def.id));
      const clauseIds = new Set(clausesFor(kind).map((clause) => clause.id));
      const paragraphIds = new Set(
        clausesFor(kind).flatMap((clause) => clause.paragraphs.filter((p) => !p.kinds || p.kinds.includes(kind)).flatMap((p) => (p.id ? [`${clause.id}.${p.id}`] : []))),
      );
      for (const clause of clausesFor(kind)) {
        for (const paragraph of clause.paragraphs) {
          if (paragraph.kinds && !paragraph.kinds.includes(kind)) continue;
          const texts = [paragraph.text, ...(paragraph.items ?? []).filter((item) => !item.kinds || item.kinds.includes(kind)).map((item) => item.text)];
          for (const token of texts.flatMap(tokensIn)) {
            const where = `${kind} / ${clause.id}: {{${token}}}`;
            if (token.startsWith('ref:')) {
              const target = token.slice(4);
              expect(clauseIds.has(target) || paragraphIds.has(target), where).toBe(true);
            } else {
              expect(KNOWN_FIXED.has(token) || variableIds.has(token) || optionIds.has(token), where).toBe(true);
            }
          }
        }
      }
    }
  });

  it('only refers to optional clauses from text that is switched off with them', () => {
    // A reference to an optional clause that is not included would be a render error; the references below must be to required clauses.
    for (const kind of CONTRACT_KINDS) {
      const optional = new Set(clausesFor(kind).filter((clause) => !clause.required).map((clause) => clause.id));
      for (const clause of clausesFor(kind)) {
        for (const paragraph of clause.paragraphs) {
          if (paragraph.kinds && !paragraph.kinds.includes(kind)) continue;
          for (const token of tokensIn(paragraph.text)) {
            if (!token.startsWith('ref:')) continue;
            const target = (token.slice(4).split('.')[0] ?? '');
            if (!optional.has(target)) continue;
            const guarded = conditionsOf(paragraph.when).some((condition) => 'included' in condition && condition.included === target);
            expect(guarded, `${kind} / ${clause.id} refers to optional clause ${target} without a guard`).toBe(true);
          }
        }
      }
    }
  });

  it('has every condition point at a known option, variable or clause', () => {
    const optionIds = new Set(LIBRARY.options.map((def) => def.id));
    const variableIds = new Set(LIBRARY.variables.map((def) => def.id));
    const clauseIds = new Set(LIBRARY.clauses.map((clause) => clause.id));
    const all: Condition[] = [
      ...LIBRARY.clauses.flatMap((clause) => clause.paragraphs.flatMap((p) => [p.when, ...(p.items ?? []).map((item) => item.when)])),
      ...LIBRARY.variables.map((def) => def.when),
      ...LIBRARY.options.map((def) => def.when),
      ...LIBRARY.questions.map((question) => question.when),
    ].flatMap(conditionsOf);
    for (const condition of all) {
      if ('option' in condition) {
        expect(optionIds.has(condition.option), condition.option).toBe(true);
        const def = LIBRARY.options.find((candidate) => candidate.id === condition.option)!;
        for (const value of typeof condition.is === 'string' ? [condition.is] : condition.is) {
          expect(def.choices.map((choice) => choice.id), `${def.id}=${value}`).toContain(value);
        }
      }
      if ('variable' in condition) expect(variableIds.has(condition.variable), condition.variable).toBe(true);
      if ('included' in condition) expect(clauseIds.has(condition.included), condition.included).toBe(true);
    }
  });

  it('keeps defaults valid', () => {
    for (const def of LIBRARY.options) {
      const ids = def.choices.map((choice) => choice.id);
      expect(new Set(ids).size, def.id).toBe(ids.length);
      if (def.default !== undefined) expect(ids, def.id).toContain(def.default);
    }
    for (const def of LIBRARY.variables) {
      const values = [def.default, ...Object.values(def.defaultByKind ?? {})].filter((value): value is string | number => value !== undefined);
      for (const value of values) {
        if (typeof value === 'number') {
          if (def.min !== undefined) expect(value, def.id).toBeGreaterThanOrEqual(def.min);
          if (def.max !== undefined) expect(value, def.id).toBeLessThanOrEqual(def.max);
        }
      }
    }
  });

  it('makes every variable used by some clause or question', () => {
    const corpus = [
      ...LIBRARY.clauses.flatMap(templatesOf),
      ...LIBRARY.questions.map((question) => question.text),
      // Used by the Schedule, which is built in code.
      'servicesDescription deliverables endDate fixedFee hourlyRate estimatedHours retainerFee retainerHours advancePercent',
    ].flatMap((text) => (text.includes('{{') ? tokensIn(text) : text.split(' ')));
    for (const def of LIBRARY.variables) expect(corpus, def.id).toContain(def.id);
  });

  it('keeps the no-non-compete decision: no such clause is offered, and a note says why', () => {
    for (const clause of LIBRARY.clauses) {
      expect(clause.id + clause.title, clause.id).not.toMatch(/non-?compete|compet/i);
      for (const text of templatesOf(clause)) expect(text, clause.id).not.toMatch(/\bcompete\b|competing business|competitor/i);
    }
    const note = LIBRARY.notes.find((candidate) => candidate.id === 'no-non-compete');
    expect(note?.body).toMatch(/not enforceable in India/);
  });

  it('contains no placeholder text and cites only the Arbitration and Conciliation Act 1996', () => {
    const everything = [
      ...LIBRARY.clauses.flatMap((clause) => [...templatesOf(clause), clause.explanation, clause.rationale, clause.risk]),
      ...LIBRARY.questions.map((question) => question.text),
      ...LIBRARY.assumptions.map((assumption) => assumption.text),
      ...LIBRARY.notes.map((note) => note.body),
      ...LIBRARY.options.flatMap((def) => [def.help, ...def.choices.flatMap((choice) => [choice.label, choice.summary])]),
      ...LIBRARY.variables.map((def) => def.help),
    ];
    for (const text of everything) {
      expect(text).not.toMatch(/lorem|ipsum|todo|tbd|xxx|\[insert/i);
      expect(text).not.toMatch(/\bsection\s+\d|\bs\.\s*\d|\bv\.\s|AIR\s+\d|\(\d{4}\)\s*\d+\s*SCC/i);
      const acts = text.match(/\b[A-Z][A-Za-z]+(?: (?:[A-Z][A-Za-z]+|and|of))* Act(?:, \d{4}| \d{4})?/g) ?? [];
      for (const act of acts) expect(act, text).toBe('Arbitration and Conciliation Act 1996');
    }
  });

  it('uses only ASCII quotes and dashes so every bundled font can print the text', () => {
    const everything = LIBRARY.clauses.flatMap((clause) => [...templatesOf(clause), clause.title, clause.explanation, clause.rationale, clause.risk]);
    for (const text of everything) expect(text).not.toMatch(/[‘’“”–—…]/);
  });

  it('makes every question relevant to its kind and linked to a real clause', () => {
    const clauseIds = new Set(LIBRARY.clauses.map((clause) => clause.id));
    for (const question of LIBRARY.questions) {
      if (question.clauseId) expect(clauseIds.has(question.clauseId), question.id).toBe(true);
      expect(question.text.length).toBeGreaterThan(30);
    }
  });
});
