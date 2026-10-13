import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createInvoiceStorage } from './repositories';
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
    await storage.invoices.save(makeInvoice({ id: 'b', number: '2026-27/0002', issueDate: '2026-10-14' }));
    await storage.invoices.save(makeInvoice({ id: 'c', number: '2026-27/0003', issueDate: '2026-10-14' }));
    expect((await storage.invoices.list()).map((invoice) => invoice.id)).toEqual(['c', 'b', 'a']);
    expect((await storage.invoices.get('b'))?.number).toBe('2026-27/0002');
    await storage.invoices.remove('b');
    expect(await storage.invoices.get('b')).toBeUndefined();
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
