import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { InvoiceLockedError, InvoiceNumberTakenError, IssuedInvoiceError, createInvoiceStorage } from './repositories';
import { makeClient, makeInvoice, makeSeller } from './testing';
import { PRESET_THEMES, createCustomTheme } from './themes';

const fixedNow = () => new Date('2026-10-14T12:00:00.000Z');
const setup = () => createInvoiceStorage(createMemoryStore(), { now: fixedNow });

describe('profile', () => {
  it('starts empty and saves under a fixed id', async () => {
    const storage = setup();
    expect(await storage.profile.get()).toBeUndefined();
    await storage.profile.save(makeSeller({ name: 'Asha' }));
    expect((await storage.profile.get())?.name).toBe('Asha');
    expect((await storage.profile.get())?.id).toBe('me');
  });
});

describe('clients', () => {
  it('lists clients by name, ignoring case, and supports get and remove', async () => {
    const storage = setup();
    await storage.clients.save(makeClient({ id: 'b', name: 'beta Ltd' }));
    await storage.clients.save(makeClient({ id: 'a', name: 'Alpha Co' }));
    await storage.clients.save(makeClient({ id: 'c', name: 'Charlie' }));
    expect((await storage.clients.list()).map((client) => client.name)).toEqual(['Alpha Co', 'beta Ltd', 'Charlie']);
    expect((await storage.clients.get('a'))?.name).toBe('Alpha Co');
    await storage.clients.remove('a');
    expect(await storage.clients.get('a')).toBeUndefined();
  });
});

describe('invoices', () => {
  it('stamps createdAt once and updatedAt on every save', async () => {
    const storage = setup();
    const saved = await storage.invoices.save(makeInvoice({ createdAt: '', updatedAt: '' }));
    expect(saved.createdAt).toBe('2026-10-14T12:00:00.000Z');
    expect(saved.updatedAt).toBe('2026-10-14T12:00:00.000Z');

    const later = createInvoiceStorage(createMemoryStore(), { now: () => new Date('2026-11-01T08:00:00.000Z') });
    const resaved = await later.invoices.save({ ...saved });
    expect(resaved.createdAt).toBe('2026-10-14T12:00:00.000Z');
    expect(resaved.updatedAt).toBe('2026-11-01T08:00:00.000Z');
  });

  it('lists newest first and supports get and remove', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0001', issueDate: '2026-10-01' }));
    await storage.invoices.save(makeInvoice({ id: 'b', number: '2026-27/0002', issueDate: '2026-10-14', status: 'draft' }));
    await storage.invoices.save(makeInvoice({ id: 'c', number: '2026-27/0003', issueDate: '2026-10-14' }));
    expect((await storage.invoices.list()).map((invoice) => invoice.id)).toEqual(['c', 'b', 'a']);
    expect((await storage.invoices.get('b'))?.number).toBe('2026-27/0002');
    await storage.invoices.remove('b');
    expect(await storage.invoices.get('b')).toBeUndefined();
  });
});

describe('invoice number integrity', () => {
  it('rejects a second invoice with the same number and leaves the store unchanged', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0001' }));
    await expect(storage.invoices.save(makeInvoice({ id: 'b', number: '2026-27/0001' }))).rejects.toBeInstanceOf(
      InvoiceNumberTakenError,
    );
    expect((await storage.invoices.list()).map((invoice) => invoice.id)).toEqual(['a']);
    expect(await storage.invoices.get('b')).toBeUndefined();
  });

  it('allows re-saving the same id with the same number', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0001' }));
    await expect(storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0001', notes: 'edited' }))).resolves.toMatchObject({
      notes: 'edited',
    });
  });

  it('refuses to delete issued invoices', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'a', status: 'issued' }));
    await expect(storage.invoices.remove('a')).rejects.toBeInstanceOf(IssuedInvoiceError);
    expect(await storage.invoices.get('a')).toBeDefined();
  });

  it('refuses to delete cancelled invoices', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'a', status: 'cancelled' }));
    await expect(storage.invoices.remove('a')).rejects.toBeInstanceOf(IssuedInvoiceError);
    expect(await storage.invoices.get('a')).toBeDefined();
  });

  it('deletes drafts and ignores missing ids', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'd', status: 'draft' }));
    await storage.invoices.remove('d');
    expect(await storage.invoices.get('d')).toBeUndefined();
    await expect(storage.invoices.remove('missing')).resolves.toBeUndefined();
  });

  it('cancels an issued invoice, keeping its number and re-stamping updatedAt', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0007' }));
    const cancelled = await storage.invoices.cancel('a');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.number).toBe('2026-27/0007');
    expect(cancelled.updatedAt).toBe('2026-10-14T12:00:00.000Z');
    expect((await storage.invoices.get('a'))?.status).toBe('cancelled');
  });

  it('cancel is idempotent', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'a' }));
    await storage.invoices.cancel('a');
    expect((await storage.invoices.cancel('a')).status).toBe('cancelled');
  });

  it('cancel rejects drafts and missing invoices', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'd', status: 'draft', number: '2026-27/0002' }));
    await expect(storage.invoices.cancel('d')).rejects.toThrow('Only issued invoices can be cancelled; delete a draft instead');
    await expect(storage.invoices.cancel('nope')).rejects.toThrow('Invoice not found');
    expect((await storage.invoices.get('d'))?.status).toBe('draft');
  });

  it('keeps counting cancelled invoices so their numbers are never reused', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0007' }));
    await storage.invoices.cancel('a');
    expect(await storage.invoices.nextNumber('2026-10-14')).toBe('2026-27/0008');
  });

  it('orders numbers naturally when issue dates tie', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'nine', number: '2026-27/0009' }));
    await storage.invoices.save(makeInvoice({ id: 'ten', number: '2026-27/0010' }));
    await storage.invoices.save(makeInvoice({ id: 'wide', number: '2026-27/100' }));
    await storage.invoices.save(makeInvoice({ id: 'narrow', number: '2026-27/2' }));
    expect((await storage.invoices.list()).map((invoice) => invoice.id)).toEqual(['wide', 'ten', 'nine', 'narrow']);
  });
});

describe('invoice numbers', () => {
  it('starts each financial year at 0001', async () => {
    const storage = setup();
    expect(await storage.invoices.nextNumber('2026-10-14')).toBe('2026-27/0001');
  });

  it('continues after the highest number in the same financial year only', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0001' }));
    await storage.invoices.save(makeInvoice({ id: 'b', number: '2026-27/0007' }));
    await storage.invoices.save(makeInvoice({ id: 'c', number: '2025-26/0099', fiscalYear: '2025-26' }));
    expect(await storage.invoices.nextNumber('2026-10-14')).toBe('2026-27/0008');
    expect(await storage.invoices.nextNumber('2026-03-31')).toBe('2025-26/0100');
    expect(await storage.invoices.nextNumber('2027-04-01')).toBe('2027-28/0001');
  });

  it('uses the prefix from the seller profile', async () => {
    const storage = setup();
    await storage.profile.save(makeSeller({ invoicePrefix: 'INV/' }));
    expect(await storage.invoices.nextNumber('2026-10-14')).toBe('INV/2026-27/0001');
  });
});

describe('number series per document kind', () => {
  it('numbers quotes and proformas in their own series', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0004' }));
    expect(await storage.invoices.nextNumber('2026-10-14', 'quote')).toBe('QT/2026-27/0001');
    expect(await storage.invoices.nextNumber('2026-10-14', 'proforma')).toBe('PF/2026-27/0001');
    await storage.invoices.save(makeInvoice({ id: 'q', kind: 'quote', number: 'QT/2026-27/0001', validUntil: '2026-11-13' }));
    await storage.invoices.save(makeInvoice({ id: 'p', kind: 'proforma', number: 'PF/2026-27/0001' }));
    expect(await storage.invoices.nextNumber('2026-10-14', 'quote')).toBe('QT/2026-27/0002');
    expect(await storage.invoices.nextNumber('2026-10-14', 'proforma')).toBe('PF/2026-27/0002');
    expect(await storage.invoices.nextNumber('2026-10-14')).toBe('2026-27/0005');
    expect(await storage.invoices.nextNumber('2027-04-01', 'quote')).toBe('QT/2027-28/0001');
  });

  it('ignores the seller prefix for quotes and proformas, and fits the 16-character limit', async () => {
    const storage = setup();
    await storage.profile.save(makeSeller({ invoicePrefix: 'INV/' }));
    expect(await storage.invoices.nextNumber('2026-10-14', 'quote')).toBe('QT/2026-27/0001');
    expect(await storage.invoices.nextNumber('2026-10-14', 'quote')).toHaveLength(15);
  });

  it('counts an old proforma that holds a tax-series number towards the tax series, and does not rewrite it', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'old', kind: 'proforma', number: '2026-27/0002' }));
    await storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0001' }));
    expect(await storage.invoices.nextNumber('2026-10-14')).toBe('2026-27/0003');
    expect((await storage.invoices.get('old'))?.number).toBe('2026-27/0002');
    expect(await storage.invoices.nextNumber('2026-10-14', 'proforma')).toBe('PF/2026-27/0001');
  });

  it('never lets a tax invoice reuse the number printed on an old proforma', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'old', kind: 'proforma', number: '2026-27/0001' }));
    await expect(storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0001' }))).rejects.toBeInstanceOf(InvoiceNumberTakenError);
    await expect(storage.invoices.save(makeInvoice({ id: 'b', kind: 'proforma', number: '2026-27/0001' }))).rejects.toBeInstanceOf(InvoiceNumberTakenError);
  });

  it('keeps new PF/ and QT/ numbers in their own series', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'p', kind: 'proforma', number: 'PF/2026-27/0001' }));
    await storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0001' }));
    await expect(storage.invoices.save(makeInvoice({ id: 'b', kind: 'proforma', number: 'PF/2026-27/0001' }))).rejects.toBeInstanceOf(InvoiceNumberTakenError);
    expect(await storage.invoices.nextNumber('2026-10-14')).toBe('2026-27/0002');
  });
});

describe('themes', () => {
  it('saves, lists and removes custom themes', async () => {
    const storage = setup();
    const custom = createCustomTheme(PRESET_THEMES[1]!, { name: 'Teal', accent: '#0F766E' }, 'custom-1');
    await storage.themes.save(custom);
    expect(await storage.themes.list()).toEqual([custom]);
    await storage.themes.remove('custom-1');
    expect(await storage.themes.list()).toEqual([]);
  });
});

describe('settings', () => {
  it('has defaults and merges updates', async () => {
    const storage = setup();
    expect(await storage.settings.get()).toEqual({ id: 'invoice', defaultThemeId: 'classic', onboarded: false });
    const updated = await storage.settings.update({ onboarded: true, defaultThemeId: 'modern' });
    expect(updated).toEqual({ id: 'invoice', defaultThemeId: 'modern', onboarded: true });
    expect(await storage.settings.get()).toEqual(updated);
    const withBackup = await storage.settings.update({ lastBackupAt: '2026-10-14T12:00:00.000Z' });
    expect(withBackup.onboarded).toBe(true);
    expect(withBackup.lastBackupAt).toBe('2026-10-14T12:00:00.000Z');
  });
});

describe('invoice repository methods can be used detached', () => {
  it('cancel and save work when pulled off the object', async () => {
    const storage = setup();
    const { save, cancel } = storage.invoices;
    await save(makeInvoice({ id: 'x', number: '2026-27/0001' }));
    const cancelled = await cancel('x');
    expect(cancelled.status).toBe('cancelled');
  });
});

describe('invoices: locking and number uniqueness', () => {
  const locked = 'This invoice has been issued and cannot be changed this way';

  it('rejects changing the number of an issued invoice', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice());
    const attempt = storage.invoices.save(makeInvoice({ number: '2026-27/0002' }));
    await expect(attempt).rejects.toBeInstanceOf(InvoiceLockedError);
    await expect(attempt).rejects.toMatchObject({ name: 'InvoiceLockedError', message: locked });
  });

  it('rejects moving an issued or cancelled invoice back to draft', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice());
    await expect(storage.invoices.save(makeInvoice({ status: 'draft' }))).rejects.toBeInstanceOf(InvoiceLockedError);
    await storage.invoices.save(makeInvoice({ status: 'cancelled' }));
    await expect(storage.invoices.save(makeInvoice({ status: 'draft' }))).rejects.toBeInstanceOf(InvoiceLockedError);
  });

  it('rejects reviving a cancelled invoice', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ status: 'cancelled' }));
    await expect(storage.invoices.save(makeInvoice({ status: 'issued' }))).rejects.toBeInstanceOf(InvoiceLockedError);
  });

  it('allows re-saving issued, cancelling, and re-saving cancelled', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ status: 'draft' }));
    await storage.invoices.save(makeInvoice());
    await storage.invoices.save(makeInvoice({ notes: 'Thanks' }));
    expect((await storage.invoices.cancel('inv-1')).status).toBe('cancelled');
    await storage.invoices.save(makeInvoice({ status: 'cancelled', notes: 'Void' }));
    expect((await storage.invoices.get('inv-1'))?.notes).toBe('Void');
  });

  it('lets a draft change its number', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ status: 'draft' }));
    await storage.invoices.save(makeInvoice({ status: 'draft', number: '2026-27/0009' }));
    expect((await storage.invoices.get('inv-1'))?.number).toBe('2026-27/0009');
  });

  it('compares numbers ignoring case and surrounding spaces', async () => {
    const storage = setup();
    await storage.invoices.save(makeInvoice({ id: 'a', number: 'INV/0001' }));
    await expect(storage.invoices.save(makeInvoice({ id: 'b', number: 'inv/0001' }))).rejects.toBeInstanceOf(InvoiceNumberTakenError);
    await expect(storage.invoices.save(makeInvoice({ id: 'b', number: ' INV/0001 ' }))).rejects.toBeInstanceOf(InvoiceNumberTakenError);
  });
});
