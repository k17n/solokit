import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { describeStoreContract } from './contract';
import { createIndexedDbStore } from './idb-store';
import { createMemoryStore } from './memory-store';
import { StorageError } from './types';

describeStoreContract('memory store', () => createMemoryStore());

let counter = 0;
const freshName = () => `solokit-test-${++counter}`;
describeStoreContract('IndexedDB store', () => createIndexedDbStore({ name: freshName() }));

describe('IndexedDB store', () => {
  it('persists across store instances that share a database name', async () => {
    const name = freshName();
    await createIndexedDbStore({ name }).put('settings', { id: 'theme', value: 'dark' } as never);
    const reopened = await createIndexedDbStore({ name }).get<{ id: string; value: string }>('settings', 'theme');
    expect(reopened).toEqual({ id: 'theme', value: 'dark' });
  });

  it('throws a StorageError when IndexedDB is unavailable', () => {
    vi.stubGlobal('indexedDB', undefined);
    try {
      expect(() => createIndexedDbStore()).toThrow(StorageError);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
