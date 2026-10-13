import { describe, expect, it } from 'vitest';
import { parseSnapshot } from './snapshot';
import { StorageError } from './types';

const valid = {
  version: 1,
  exportedAt: '2026-10-14T10:00:00.000Z',
  collections: {
    profile: [{ id: 'me', name: 'Asha' }],
    clients: [],
    invoices: [{ id: 'inv-1' }],
    themes: [],
    settings: [],
  },
};

describe('parseSnapshot', () => {
  it('accepts a valid snapshot', () => {
    expect(parseSnapshot(valid)).toEqual(valid);
  });

  it('treats a missing collection as empty', () => {
    const { clients: _clients, ...rest } = valid.collections;
    const parsed = parseSnapshot({ ...valid, collections: rest });
    expect(parsed.collections.clients).toEqual([]);
  });

  it('ignores unknown collections', () => {
    const parsed = parseSnapshot({ ...valid, collections: { ...valid.collections, secrets: [{ id: 'x' }] } });
    expect('secrets' in parsed.collections).toBe(false);
  });

  it('rejects anything that is not a version 1 snapshot', () => {
    for (const bad of [null, 'text', 42, [], {}, { ...valid, version: 2 }, { ...valid, exportedAt: 5 }]) {
      expect(() => parseSnapshot(bad)).toThrow(StorageError);
    }
  });

  it('rejects records without a string id', () => {
    const bad = { ...valid, collections: { ...valid.collections, clients: [{ name: 'No id' }] } };
    expect(() => parseSnapshot(bad)).toThrow(StorageError);
    const empty = { ...valid, collections: { ...valid.collections, clients: [{ id: '' }] } };
    expect(() => parseSnapshot(empty)).toThrow(StorageError);
  });

  it('rejects a collection that is not an array', () => {
    const bad = { ...valid, collections: { ...valid.collections, invoices: {} } };
    expect(() => parseSnapshot(bad)).toThrow(StorageError);
  });
});
