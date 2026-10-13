import { describe, expect, it } from 'vitest';
import { StorageError, type DataStore } from './types';

interface Doc {
  id: string;
  name: string;
  nested?: { count: number };
}

/** The behaviour every DataStore adapter must have. */
export function describeStoreContract(label: string, makeStore: () => DataStore) {
  describe(`${label} (DataStore contract)`, () => {
    it('returns undefined for a missing record', async () => {
      const store = makeStore();
      expect(await store.get('clients', 'nope')).toBeUndefined();
    });

    it('stores and reads a record', async () => {
      const store = makeStore();
      await store.put<Doc>('clients', { id: 'c1', name: 'Acme', nested: { count: 2 } });
      expect(await store.get<Doc>('clients', 'c1')).toEqual({ id: 'c1', name: 'Acme', nested: { count: 2 } });
    });

    it('overwrites a record with the same id', async () => {
      const store = makeStore();
      await store.put<Doc>('clients', { id: 'c1', name: 'Old' });
      await store.put<Doc>('clients', { id: 'c1', name: 'New' });
      expect(await store.list<Doc>('clients')).toEqual([{ id: 'c1', name: 'New' }]);
    });

    it('never shares objects with the caller', async () => {
      const store = makeStore();
      const original: Doc = { id: 'c1', name: 'Acme', nested: { count: 1 } };
      await store.put('clients', original);
      original.nested!.count = 99;
      const read = await store.get<Doc>('clients', 'c1');
      expect(read?.nested?.count).toBe(1);
      read!.nested!.count = 50;
      expect((await store.get<Doc>('clients', 'c1'))?.nested?.count).toBe(1);
    });

    it('lists every record in a collection', async () => {
      const store = makeStore();
      await store.put<Doc>('invoices', { id: 'a', name: 'A' });
      await store.put<Doc>('invoices', { id: 'b', name: 'B' });
      const ids = (await store.list<Doc>('invoices')).map((doc) => doc.id).sort();
      expect(ids).toEqual(['a', 'b']);
    });

    it('keeps collections separate', async () => {
      const store = makeStore();
      await store.put<Doc>('clients', { id: 'x', name: 'Client' });
      expect(await store.get('invoices', 'x')).toBeUndefined();
    });

    it('removes a record and tolerates removing a missing one', async () => {
      const store = makeStore();
      await store.put<Doc>('clients', { id: 'c1', name: 'Acme' });
      await store.remove('clients', 'c1');
      await store.remove('clients', 'c1');
      expect(await store.list('clients')).toEqual([]);
    });

    it('rejects a record without an id', async () => {
      const store = makeStore();
      await expect(store.put('clients', { id: '', name: 'x' } as Doc)).rejects.toBeInstanceOf(StorageError);
    });

    it('exports a snapshot containing every collection', async () => {
      const store = makeStore();
      await store.put<Doc>('profile', { id: 'me', name: 'Asha' });
      const snapshot = await store.exportAll();
      expect(snapshot.version).toBe(1);
      expect(typeof snapshot.exportedAt).toBe('string');
      expect(Object.keys(snapshot.collections).sort()).toEqual(['clients', 'invoices', 'profile', 'settings', 'themes']);
      expect(snapshot.collections.profile).toEqual([{ id: 'me', name: 'Asha' }]);
    });

    it('imports a snapshot, replacing everything', async () => {
      const source = makeStore();
      await source.put<Doc>('clients', { id: 'c1', name: 'From backup' });
      const backup = JSON.parse(JSON.stringify(await source.exportAll())) as unknown;

      const target = makeStore();
      await target.put<Doc>('clients', { id: 'old', name: 'Will be removed' });
      await target.put<Doc>('invoices', { id: 'i-old', name: 'Also removed' });
      await target.importAll(backup);

      expect(await target.list<Doc>('clients')).toEqual([{ id: 'c1', name: 'From backup' }]);
      expect(await target.list('invoices')).toEqual([]);
    });

    it('rejects an invalid snapshot and leaves existing data alone', async () => {
      const store = makeStore();
      await store.put<Doc>('clients', { id: 'keep', name: 'Keep me' });
      await expect(store.importAll({ version: 2 })).rejects.toBeInstanceOf(StorageError);
      await expect(store.importAll('nonsense')).rejects.toBeInstanceOf(StorageError);
      expect(await store.list<Doc>('clients')).toEqual([{ id: 'keep', name: 'Keep me' }]);
    });

    it('rejects a snapshot whose later collection is invalid and leaves existing data alone', async () => {
      const store = makeStore();
      await store.put<Doc>('clients', { id: 'keep', name: 'Keep me' });
      const bad = {
        version: 1,
        exportedAt: new Date().toISOString(),
        collections: { profile: [{ id: 'p', name: 'ok' }], invoices: [{ name: 'no id' }] },
      };
      await expect(store.importAll(bad)).rejects.toBeInstanceOf(StorageError);
      expect(await store.list<Doc>('clients')).toEqual([{ id: 'keep', name: 'Keep me' }]);
      expect(await store.list('profile')).toEqual([]);
    });

    it('rejects an import with a non-clonable record and leaves every collection unchanged', async () => {
      const store = makeStore();
      await store.put<Doc>('clients', { id: 'c1', name: 'Keep client' });
      await store.put<Doc>('invoices', { id: 'i1', name: 'Keep invoice' });
      const bad = {
        version: 1,
        exportedAt: new Date().toISOString(),
        collections: { profile: [{ id: 'p', name: 'ok' }], clients: [{ id: 'bad', fn: () => 1 }] },
      };
      await expect(store.importAll(bad)).rejects.toBeInstanceOf(StorageError);
      expect(await store.list<Doc>('clients')).toEqual([{ id: 'c1', name: 'Keep client' }]);
      expect(await store.list<Doc>('invoices')).toEqual([{ id: 'i1', name: 'Keep invoice' }]);
      expect(await store.list('profile')).toEqual([]);
    });

    it('rejects a put with a non-clonable record and does not change the store', async () => {
      const store = makeStore();
      await store.put<Doc>('clients', { id: 'c1', name: 'Keep' });
      await expect(store.put('clients', { id: 'bad', fn: () => 1 } as never)).rejects.toBeInstanceOf(StorageError);
      expect(await store.list<Doc>('clients')).toEqual([{ id: 'c1', name: 'Keep' }]);
    });
  });
}
