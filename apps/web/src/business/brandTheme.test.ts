import { describe, expect, it } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { PRESET_THEMES, createCustomTheme, createInvoiceStorage, type InvoiceTheme } from '@solokit/tool-invoice';
import { makeSeller } from '@solokit/tool-invoice/testing';
import { BrandThemeError, applyBrandTheme, brandThemeColours, brandThemeState, themeSignature } from './brandTheme';

const brand = { primary: '#7C2D12', text: '#1A1A1A', background: '#FFFFFF' };

async function setup(profile = makeSeller({ name: 'Asha Rao', brand, brandSource: 'logo' })) {
  const storage = createInvoiceStorage(createMemoryStore());
  await storage.profile.save(profile);
  let n = 0;
  return { storage, makeId: () => `brand-${++n}` };
}

describe('brandThemeColours', () => {
  it('uses the primary colour as the accent and falls back for text and background', () => {
    expect(brandThemeColours({ brand: { primary: '#7c2d12' } })).toEqual({ accent: '#7C2D12', text: '#1A1A1A', background: '#FFFFFF' });
    expect(brandThemeColours({})).toBeNull();
    expect(brandThemeColours({ brand: { secondary: '#112233' } })).toBeNull();
  });
});

describe('brandThemeState', () => {
  const profile = makeSeller({ brand });
  it('has nothing to offer without brand colours', () => {
    expect(brandThemeState(makeSeller(), [])).toEqual({ kind: 'none' });
  });
  it('offers to create when there is no linked theme, and says so when the linked one was deleted', () => {
    expect(brandThemeState(profile, [])).toEqual({ kind: 'create', previouslyDeleted: false });
    expect(brandThemeState({ ...profile, brandTheme: { themeId: 'gone', signature: 'x' } }, [])).toEqual({ kind: 'create', previouslyDeleted: true });
  });
  it('tells a current, an untouched stale and an edited theme apart', () => {
    const base = PRESET_THEMES[1] as InvoiceTheme;
    const theme = createCustomTheme(base, { name: 'Asha brand', accent: '#7C2D12', text: '#1A1A1A', background: '#FFFFFF' }, 't1');
    const link = { themeId: 't1', signature: themeSignature(theme) };
    expect(brandThemeState({ ...profile, brandTheme: link }, [theme]).kind).toBe('current');
    const moved = { ...profile, brand: { ...brand, primary: '#0F766E' }, brandTheme: link };
    expect(brandThemeState(moved, [theme]).kind).toBe('update');
    const edited = createCustomTheme(theme, { fontId: 'poppins' }, 't1');
    expect(brandThemeState(moved, [edited]).kind).toBe('edited');
    // Renaming alone is not editing.
    expect(brandThemeState(moved, [createCustomTheme(theme, { name: 'Renamed' }, 't1')]).kind).toBe('update');
  });
});

describe('applyBrandTheme', () => {
  it('creates a "<Business> brand" theme from the brand colours, links it, and can make it the default', async () => {
    const { storage, makeId } = await setup();
    const result = await applyBrandTheme(storage, { mode: 'create', makeDefault: true, makeId });
    expect(result.theme).toMatchObject({ id: 'brand-1', name: 'Asha Rao brand', layout: 'modern', accent: '#7C2D12', text: '#1A1A1A', background: '#FFFFFF', fontId: 'inter' });
    expect(await storage.themes.list()).toEqual([result.theme]);
    expect((await storage.profile.get())?.brandTheme).toEqual({ themeId: 'brand-1', signature: themeSignature(result.theme) });
    expect((await storage.settings.get()).defaultThemeId).toBe('brand-1');
  });

  it('keeps the default theme unless asked', async () => {
    const { storage, makeId } = await setup();
    await applyBrandTheme(storage, { mode: 'create', makeId });
    expect((await storage.settings.get()).defaultThemeId).toBe('classic');
  });

  it('names a second brand theme with a number', async () => {
    const { storage, makeId } = await setup();
    await applyBrandTheme(storage, { mode: 'create', makeId });
    const second = await applyBrandTheme(storage, { mode: 'create', makeId });
    expect(second.theme.name).toBe('Asha Rao brand 2');
  });

  it('updates an untouched brand theme in place when the colours change, keeping its name and font', async () => {
    const { storage, makeId } = await setup();
    await applyBrandTheme(storage, { mode: 'create', makeId });
    const profile = (await storage.profile.get())!;
    await storage.profile.save({ ...profile, brand: { ...brand, primary: '#0F766E' } });
    const updated = await applyBrandTheme(storage, { mode: 'update' });
    expect(updated.theme).toMatchObject({ id: 'brand-1', accent: '#0F766E', name: 'Asha Rao brand' });
    expect(await storage.themes.list()).toHaveLength(1);
    expect(brandThemeState((await storage.profile.get())!, await storage.themes.list()).kind).toBe('current');
  });

  it('never overwrites a theme the person edited', async () => {
    const { storage, makeId } = await setup();
    const { theme } = await applyBrandTheme(storage, { mode: 'create', makeId });
    await storage.themes.save({ ...theme, fontId: 'poppins' });
    const profile = (await storage.profile.get())!;
    await storage.profile.save({ ...profile, brand: { ...brand, primary: '#0F766E' } });
    await expect(applyBrandTheme(storage, { mode: 'update' })).rejects.toBeInstanceOf(BrandThemeError);
    expect((await storage.themes.list())[0]?.accent).toBe('#7C2D12');
    const fresh = await applyBrandTheme(storage, { mode: 'create', makeId });
    expect(fresh.theme).toMatchObject({ id: 'brand-2', accent: '#0F766E' });
    expect(await storage.themes.list()).toHaveLength(2);
  });

  it('refuses colours that are not readable, and writes nothing', async () => {
    const { storage, makeId } = await setup(makeSeller({ name: 'Pale', brand: { primary: '#FFE08A' } }));
    const error = await applyBrandTheme(storage, { mode: 'create', makeId }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BrandThemeError);
    expect((error as BrandThemeError).problems.join(' ')).toMatch(/accent/i);
    expect(await storage.themes.list()).toEqual([]);
    expect((await storage.profile.get())?.brandTheme).toBeUndefined();
  });

  it('needs a saved profile with brand colours', async () => {
    const empty = createInvoiceStorage(createMemoryStore());
    await expect(applyBrandTheme(empty, { mode: 'create' })).rejects.toThrow(/Save your business details/);
    const { storage } = await setup(makeSeller());
    await expect(applyBrandTheme(storage, { mode: 'create' })).rejects.toThrow(/brand colours/);
  });
});
