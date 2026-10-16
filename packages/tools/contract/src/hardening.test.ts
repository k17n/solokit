import { StorageError, createMemoryStore } from '@solokit/storage';
import { describe, expect, it } from 'vitest';
import { checkContractRecords } from './backup';
import { buildContractDocument, documentText, resolveContractDocument } from './document';
import { LIBRARY } from './library';
import type { ContractLibraryShape } from './library-types';
import { createContractStorage } from './repositories';
import { buildReviewPack, buildReviewSummary } from './review';
import { makeContract, makeParty } from './testing';
import { contractWarnings, validateContract } from './validation';

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('control characters in user text', () => {
  const dirty = (): ReturnType<typeof makeContract> => {
    const contract = makeContract('services');
    return {
      ...contract,
      parties: [makeParty({ role: 'freelancer', name: 'Asha\u000BRao\u0001 Consulting' }), contract.parties[1]!],
      variables: { ...contract.variables, servicesDescription: 'Design a site\u000CSet up the form\u0007' },
    };
  };

  it('are reported by validation, against the field that holds them', () => {
    const issues = validateContract(dirty());
    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining(['parties.0.name', 'variables.servicesDescription']));
    expect(issues.find((issue) => issue.path === 'parties.0.name')?.message).toMatch(/control character/);
  });

  it('are removed from the document, so no export can hold them', () => {
    const text = documentText(buildContractDocument(dirty()));
    expect(text).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(text).toContain('Asha Rao Consulting');
    expect(text).toContain('Design a site Set up the form');
  });

  it('are removed from a frozen document and from the review pack as well', () => {
    const draft = makeContract('nda-mutual');
    const frozen = { ...buildContractDocument(draft), heading: 'Mutual\u000BNDA\u0002' };
    const contract = { ...draft, status: 'final' as const, finalDocument: frozen };
    expect(resolveContractDocument(contract).heading).toBe('Mutual NDA');
    const pack = buildReviewPack({ ...dirty() });
    expect(JSON.stringify(pack)).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  });
});

describe('characters the PDF fonts cannot print', () => {
  it('give a warning, not an error, on the field that holds them', () => {
    const contract = makeContract('nda-mutual');
    const withName = { ...contract, parties: [makeParty({ role: 'first', name: 'アシャ Consulting' }), contract.parties[1]!] };
    expect(validateContract(withName)).toEqual([]);
    const warnings = contractWarnings(withName);
    expect(warnings).toEqual([{ path: 'parties.0.name', message: 'Some characters (ア シ ャ) will not print in the PDF; the Word version will show them.' }]);
  });

  it('are checked in names, signatories, text settings and milestones', () => {
    const base = makeContract('services');
    const contract = {
      ...base,
      parties: [makeParty({ role: 'freelancer', signatoryName: 'आशा राव' }), base.parties[1]!],
      variables: { ...base.variables, deliverables: 'Logo 标志' },
      milestones: [{ id: 'm1', title: '设计', amount: 1000, due: 'on approval' }],
    };
    expect(contractWarnings(contract).map((warning) => warning.path)).toEqual(['parties.0.signatoryName', 'variables.deliverables', 'milestones.0.title']);
  });

  it('give no warning for accents, the rupee sign and ordinary punctuation', () => {
    const base = makeContract('nda-one-way');
    const contract = { ...base, parties: [makeParty({ role: 'disclosing', name: 'José Müller & Łukasz – “Sons” ₹' }), base.parties[1]!] };
    expect(contractWarnings(contract)).toEqual([]);
  });

  it('appear in the review summary, which a lawyer reads', () => {
    const base = makeContract('nda-mutual');
    const contract = { ...base, parties: [makeParty({ role: 'first', name: 'アシャ Consulting' }), base.parties[1]!] };
    expect(buildReviewSummary(contract).warnings).toEqual(['Some characters (ア シ ャ) will not print in the PDF; the Word version will show them.']);
    expect(buildReviewSummary(base).warnings).toEqual([]);
  });
});

/** A library whose version and explanations differ from the real one, as after a template update. */
function updatedLibrary(): ContractLibraryShape {
  return {
    ...LIBRARY,
    version: '2099-01-01.1',
    clauses: LIBRARY.clauses.map((clause) => ({ ...clause, explanation: `UPDATED: ${clause.explanation}` })),
    questions: [...LIBRARY.questions, { id: 'new-question', topic: 'A question added later', text: 'Is this new?', kinds: ['services'] as const }],
  };
}

describe('the review pack of a final agreement', () => {
  async function finalised() {
    const store = createMemoryStore();
    const storage = createContractStorage(store, { now: () => new Date('2026-10-16T10:00:00Z') });
    await store.put('contracts', makeContract('services'));
    return storage.finalise('contract-services');
  }

  it('is frozen with the wording, so a later template update cannot change what it says', async () => {
    const final = await finalised();
    expect(final.finalSummary?.libraryVersion).toBe(LIBRARY.version);
    const pack = buildReviewPack(final, updatedLibrary());
    expect(pack.summary.libraryVersion).toBe(LIBRARY.version);
    expect(pack.summary.clauses.every((clause) => !clause.explanation.startsWith('UPDATED'))).toBe(true);
    expect(pack.summary.questions.map((question) => question.topic)).not.toContain('A question added later');
    expect(pack.summary.frozenNote).toBeUndefined();
    expect(pack.document).toEqual(final.finalDocument);
  });

  it('drops the frozen summary when reopened, saved or duplicated, and writes a new one when finalised again', async () => {
    const store = createMemoryStore();
    let n = 0;
    const storage = createContractStorage(store, { now: () => new Date(Date.UTC(2026, 9, 16, 10, 0, n++)) });
    await store.put('contracts', makeContract('services'));
    const final = await storage.finalise('contract-services');
    expect(final.finalSummary).toBeDefined();
    const copy = await storage.duplicate(final.id, { id: 'copy' });
    expect(copy.finalSummary).toBeUndefined();
    const reopened = await storage.reopen(final.id);
    expect(reopened.finalSummary).toBeUndefined();
    expect(reopened.finalDocument).toBeUndefined();
    const again = await storage.finalise(final.id);
    expect(again.finalSummary).toBeDefined();
  });

  it('says plainly which template version the wording was frozen under when no summary was frozen (older agreements)', async () => {
    const final = await finalised();
    const { finalSummary: _gone, ...older } = final;
    const frozenUnderOld = { ...older, finalDocument: { ...final.finalDocument!, libraryVersion: '2026-01-01.1' } };
    const pack = buildReviewPack(frozenUnderOld, LIBRARY);
    expect(pack.summary.frozenNote).toContain('frozen under template version 2026-01-01.1');
    expect(pack.summary.frozenNote).toContain(`current template version ${LIBRARY.version}`);
    expect(pack.summary.libraryVersion).toBe('2026-01-01.1');
  });

  it('never leaves an explanation blank: a clause missing from the current template gets an explicit note', async () => {
    const final = await finalised();
    const { finalSummary: _gone, ...older } = final;
    const trimmed: ContractLibraryShape = { ...LIBRARY, version: '2099-01-01.1', clauses: LIBRARY.clauses.filter((clause) => clause.id !== 'ip') };
    const pack = buildReviewPack(older, trimmed);
    const ip = pack.summary.clauses.find((clause) => clause.title === 'Intellectual property')!;
    expect(ip.explanation).toMatch(/not in the current template/);
    expect(ip.rationale).not.toBe('');
    expect(ip.risk).not.toBe('');
    expect(pack.summary.frozenNote).toBeDefined();
  });
});

describe('checking agreements in a backup, deeply', () => {
  const rec = () => json(makeContract('nda-mutual', { status: 'final', finalDocument: buildContractDocument(makeContract('nda-mutual')), finalSummary: buildReviewSummary(makeContract('nda-mutual')) }));
  const mutate = (change: (record: Record<string, any>) => void) => {
    const record = rec() as unknown as Record<string, any>;
    change(record);
    return record;
  };

  it('accepts a complete final agreement with its frozen wording and summary', () => {
    expect(() => checkContractRecords([rec()])).not.toThrow();
  });

  it('rejects parties whose roles do not match the kind, or are in the wrong order', () => {
    expect(() => checkContractRecords([mutate((r) => { r.parties[0].role = 'freelancer'; })])).toThrow(StorageError);
    expect(() => checkContractRecords([mutate((r) => { r.parties.reverse(); })])).toThrow(/do not match/);
    expect(() => checkContractRecords([mutate((r) => { r.kind = 'services'; })])).toThrow(StorageError);
  });

  it('rejects frozen wording whose clauses, paragraphs or signatures are damaged', () => {
    const damage: ((r: Record<string, any>) => void)[] = [
      (r) => { r.finalDocument.clauses[0].id = 5; },
      (r) => { delete r.finalDocument.clauses[0].title; },
      (r) => { r.finalDocument.clauses[0].paragraphs = 'none'; },
      (r) => { r.finalDocument.clauses[0].paragraphs[0].text = null; },
      (r) => { r.finalDocument.clauses[0].paragraphs[0].items = {}; },
      (r) => { r.finalDocument.signatures = []; },
      (r) => { r.finalDocument.signatures[0] = { heading: 'x' }; },
      (r) => { r.finalDocument.parties = 'two'; },
      (r) => { delete r.finalDocument.heading; },
      (r) => { r.finalDocument.schedules = [{ title: 'x', sections: [{ heading: 'h', lines: [1] }] }]; },
      (r) => { r.finalDocument.contractId = 'someone-else'; },
      (r) => { r.finalDocument.kind = 'services'; },
      (r) => { r.finalDocument.libraryVersion = 3; },
    ];
    for (const [index, change] of damage.entries()) {
      expect(() => checkContractRecords([mutate(change)]), `damage ${index}`).toThrow(/damaged final wording/);
    }
  });

  it('rejects a frozen review summary that cannot be read', () => {
    expect(() => checkContractRecords([mutate((r) => { r.finalSummary.clauses = 'x'; })])).toThrow(/damaged review summary/);
    expect(() => checkContractRecords([mutate((r) => { delete r.finalSummary.stampDuty; })])).toThrow(/damaged review summary/);
  });
});
