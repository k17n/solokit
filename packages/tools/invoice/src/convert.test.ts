import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { convertToInvoice } from './convert';
import { ConversionError, createInvoiceStorage } from './repositories';
import type { InvoiceRecord } from './model';
import { makeInvoice, makeSeller } from './testing';
import { validateInvoice } from './validation';

const now = new Date('2026-10-20T09:00:00.000Z');
const quote = (overrides = {}) =>
  makeInvoice({
    id: 'q1',
    kind: 'quote',
    number: 'QT/2026-27/0001',
    validUntil: '2026-11-13',
    notes: 'Thanks',
    terms: 'Net 15',
    ...overrides,
  });

describe('convertToInvoice', () => {
  it('makes a draft tax invoice with the quote content and a link back', () => {
    const source = quote({ reverseCharge: true, tds: { ratePercent: 10 } });
    const result = convertToInvoice(source, { id: 'i1', number: '2026-27/0001', issueDate: '2026-10-20', now });
    expect(result).toMatchObject({
      id: 'i1',
      number: '2026-27/0001',
      kind: 'invoice',
      status: 'draft',
      fiscalYear: '2026-27',
      issueDate: '2026-10-20',
      convertedFromId: 'q1',
      notes: 'Thanks',
      terms: 'Net 15',
      reverseCharge: false,
      createdAt: '2026-10-20T09:00:00.000Z',
    });
    expect(result.validUntil).toBeUndefined();
    expect(result.dueDate).toBeUndefined();
    expect(result.tds).toBeUndefined();
    expect(result.lines).toEqual(source.lines);
    expect(result.client).toEqual(source.client);
    expect(source.status).toBe('issued');
    expect(source.convertedToId).toBeUndefined();
  });

  it('uses the current seller when given and keeps TDS and reverse charge from a proforma', () => {
    const seller = makeSeller({ name: 'Renamed' });
    const result = convertToInvoice(makeInvoice({ kind: 'proforma', reverseCharge: true, tds: { ratePercent: 10 }, advanceReceived: 5 }), {
      id: 'i1',
      number: '2026-27/0001',
      issueDate: '2026-10-20',
      seller,
      now,
    });
    expect(result.seller.name).toBe('Renamed');
    expect(result.reverseCharge).toBe(true);
    expect(result.tds).toEqual({ ratePercent: 10 });
    expect(result.advanceReceived).toBe(5);
  });

  it('drops the advance of a quotation, which never had one', () => {
    const result = convertToInvoice(quote({ advanceReceived: 5 }), { id: 'i1', number: '2026-27/0001', issueDate: '2026-10-20', now });
    expect(result.advanceReceived).toBeUndefined();
  });
});

describe('storage.invoices.convert', () => {
  const setup = async () => {
    const storage = createInvoiceStorage(createMemoryStore(), { now: () => now });
    await storage.invoices.save(quote());
    return storage;
  };

  it('creates a draft with the next tax-series number and marks the quote converted, leaving it issued', async () => {
    const storage = await setup();
    await storage.invoices.save(makeInvoice({ id: 'old', number: '2026-27/0004' }));
    const draft = await storage.invoices.convert('q1', { id: 'i1', issueDate: '2026-10-20' });
    expect(draft).toMatchObject({ id: 'i1', number: '2026-27/0005', kind: 'invoice', status: 'draft', convertedFromId: 'q1' });
    expect(await storage.invoices.get('i1')).toBeDefined();
    const source = await storage.invoices.get('q1');
    expect(source).toMatchObject({ status: 'issued', convertedToId: 'i1', number: 'QT/2026-27/0001' });
    expect(await storage.invoices.nextNumber('2026-10-20', 'quote')).toBe('QT/2026-27/0002');
  });

  it('uses the profile as saved now', async () => {
    const storage = await setup();
    await storage.profile.save(makeSeller({ name: 'New Name' }));
    expect((await storage.invoices.convert('q1', { id: 'i1', issueDate: '2026-10-20' })).seller.name).toBe('New Name');
  });

  it('carries an unconfirmed GST status from the stored profile, so the draft cannot be issued until it is confirmed', async () => {
    const storage = await setup();
    await storage.profile.save(makeSeller({ gstUnconfirmed: true }));
    const draft = await storage.invoices.convert('q1', { id: 'i1', issueDate: '2026-10-20' });
    expect(draft.seller.gstUnconfirmed).toBe(true);
    expect(validateInvoice(draft).map((issue) => issue.path)).toContain('seller.gstStatus');
  });

  it('refuses a draft, a cancelled quote, an invoice, a missing id and a second conversion', async () => {
    const storage = await setup();
    await storage.invoices.save(quote({ id: 'd', number: 'QT/2026-27/0002', status: 'draft' }));
    await storage.invoices.save(quote({ id: 'c', number: 'QT/2026-27/0003', status: 'cancelled' }));
    await storage.invoices.save(makeInvoice({ id: 'inv', number: '2026-27/0001' }));
    for (const id of ['d', 'c', 'inv', 'missing']) {
      await expect(storage.invoices.convert(id, { id: 'x', issueDate: '2026-10-20' })).rejects.toBeInstanceOf(ConversionError);
    }
    await storage.invoices.convert('q1', { id: 'i1', issueDate: '2026-10-20' });
    await expect(storage.invoices.convert('q1', { id: 'i2', issueDate: '2026-10-20' })).rejects.toBeInstanceOf(ConversionError);
    expect(await storage.invoices.get('i2')).toBeUndefined();
  });

  it('converts a proforma too', async () => {
    const storage = createInvoiceStorage(createMemoryStore(), { now: () => now });
    await storage.invoices.save(makeInvoice({ id: 'p', kind: 'proforma', number: 'PF/2026-27/0001' }));
    const draft = await storage.invoices.convert('p', { id: 'i1', issueDate: '2026-10-20' });
    expect(draft.number).toBe('2026-27/0001');
  });

  it('frees the quote for another conversion when the draft is deleted', async () => {
    const storage = await setup();
    await storage.invoices.convert('q1', { id: 'i1', issueDate: '2026-10-20' });
    await storage.invoices.remove('i1');
    expect((await storage.invoices.get('q1'))?.convertedToId).toBeUndefined();
    await expect(storage.invoices.convert('q1', { id: 'i2', issueDate: '2026-10-20' })).resolves.toMatchObject({ id: 'i2' });
  });

  it('refuses a record without a kind, which is a tax invoice', async () => {
    const storage = createInvoiceStorage(createMemoryStore(), { now: () => now });
    const { kind: _kind, ...legacy } = makeInvoice({ id: 'legacy', number: '2026-27/0001' });
    await storage.invoices.save(legacy as unknown as InvoiceRecord);
    await expect(storage.invoices.convert('legacy', { id: 'x', issueDate: '2026-10-20' })).rejects.toBeInstanceOf(ConversionError);
  });

  it('carries the advance of a proforma onto the draft', async () => {
    const storage = createInvoiceStorage(createMemoryStore(), { now: () => now });
    await storage.invoices.save(makeInvoice({ id: 'p', kind: 'proforma', number: 'PF/2026-27/0001', advanceReceived: 500 }));
    expect((await storage.invoices.convert('p', { id: 'i1', issueDate: '2026-10-20' })).advanceReceived).toBe(500);
  });

  it('works when called without its storage object as this', async () => {
    const storage = await setup();
    const { convert } = storage.invoices;
    await expect(convert('q1', { id: 'i1', issueDate: '2026-10-20' })).resolves.toMatchObject({ id: 'i1' });
  });

  it('reuses a draft already made from the document instead of creating another', async () => {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => now });
    await storage.invoices.save(quote());
    // An earlier attempt saved the draft but never linked the quotation.
    const first = await storage.invoices.convert('q1', { id: 'i1', issueDate: '2026-10-20' });
    const { convertedToId: _linked, ...unlinked } = (await storage.invoices.get('q1'))!;
    await store.put('invoices', unlinked);
    const again = await storage.invoices.convert('q1', { id: 'i2', issueDate: '2026-10-20' });
    expect(again.id).toBe(first.id);
    expect(await storage.invoices.get('i2')).toBeUndefined();
    expect((await storage.invoices.get('q1'))?.convertedToId).toBe('i1');
  });

  it('refuses when the document was converted by someone else while this conversion was working', async () => {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => now });
    await storage.invoices.save(quote());
    // The profile is read during conversion; link the quotation at that moment.
    const realGet = store.get.bind(store);
    let linked = false;
    const racing = {
      ...store,
      get: async (collection: Parameters<typeof store.get>[0], id: string) => {
        const result = await realGet(collection, id);
        if (collection === 'profile' && !linked) {
          linked = true;
          await store.put('invoices', { ...((await realGet('invoices', 'q1')) as InvoiceRecord), convertedToId: 'other' });
        }
        return result;
      },
    } as typeof store;
    await expect(createInvoiceStorage(racing, { now: () => now }).invoices.convert('q1', { id: 'i1', issueDate: '2026-10-20' })).rejects.toBeInstanceOf(ConversionError);
    expect(await storage.invoices.get('i1')).toBeUndefined();
  });

  it('removes the draft and rethrows when the document cannot be linked', async () => {
    const store = createMemoryStore();
    const storage = createInvoiceStorage(store, { now: () => now });
    await storage.invoices.save(quote());
    const failing = {
      ...store,
      put: async (collection: Parameters<typeof store.put>[0], record: { id: string }) => {
        if (collection === 'invoices' && record.id === 'q1') throw new Error('disk full');
        return store.put(collection, record as never);
      },
    } as typeof store;
    await expect(createInvoiceStorage(failing, { now: () => now }).invoices.convert('q1', { id: 'i1', issueDate: '2026-10-20' })).rejects.toThrow('disk full');
    expect(await storage.invoices.get('i1')).toBeUndefined();
    expect((await storage.invoices.get('q1'))?.convertedToId).toBeUndefined();
  });

  it('keeps the quote read-only after conversion', async () => {
    const storage = await setup();
    await storage.invoices.convert('q1', { id: 'i1', issueDate: '2026-10-20' });
    await expect(storage.invoices.remove('q1')).rejects.toThrow();
  });
});
