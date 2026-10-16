import { StorageError } from '@solokit/storage';
import { describe, expect, it } from 'vitest';
import { buildContractDocument } from './document';
import { checkContractRecords } from './backup';
import { makeContract } from './testing';

const record = (overrides: Record<string, unknown> = {}) => ({ ...JSON.parse(JSON.stringify(makeContract('services'))), ...overrides }) as Record<string, unknown>;

describe('checkContractRecords', () => {
  it('accepts no contracts at all, which is what a backup from before agreements holds', () => {
    expect(() => checkContractRecords([])).not.toThrow();
  });

  it('accepts a draft of each kind', () => {
    for (const kind of ['nda-mutual', 'nda-one-way', 'services'] as const) {
      expect(() => checkContractRecords([JSON.parse(JSON.stringify(makeContract(kind)))])).not.toThrow();
    }
  });

  it('accepts a final contract with its frozen wording', () => {
    const draft = makeContract('nda-mutual');
    const final = { ...draft, status: 'final', finalDocument: buildContractDocument(draft) };
    expect(() => checkContractRecords([JSON.parse(JSON.stringify(final))])).not.toThrow();
  });

  it('rejects anything that is not a usable agreement', () => {
    const bad: unknown[] = [
      'text',
      null,
      record({ kind: 'lease' }),
      record({ status: 'signed' }),
      record({ title: 5 }),
      record({ parties: [] }),
      record({ parties: [{ name: 'x' }, { name: 'y' }] }),
      record({ variables: { a: true } }),
      record({ options: { a: 1 } }),
      record({ clauseOverrides: { a: 'yes' } }),
      record({ milestones: [{ id: 'm' }] }),
      record({ jurisdiction: { city: 'x' } }),
      record({ version: '1' }),
      record({ libraryVersion: undefined }),
      record({ status: 'final' }),
      record({ finalDocument: { clauses: 'no' } }),
    ];
    for (const item of bad) expect(() => checkContractRecords([item]), JSON.stringify(item)?.slice(0, 80)).toThrow(StorageError);
  });
});
