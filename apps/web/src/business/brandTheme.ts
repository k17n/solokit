import { NEUTRAL_TEXT, PAGE_BACKGROUND, type BrandThemeLink, type BusinessProfile } from '@solokit/profile';
import { PRESET_THEMES, createCustomTheme, validateTheme, type FontId, type InvoiceStorage, type InvoiceTheme } from '@solokit/tool-invoice';
import { newId } from '../invoice/ids';
import { uniqueThemeName } from '../invoice/themeEditing';

/** The three colours a theme takes from the brand: the accent is the brand's primary colour. */
export interface BrandThemeColours {
  accent: string;
  text: string;
  background: string;
}

/** The brand colours as theme colours, or null when the profile has no primary colour. Text and background fall back to the defaults. */
export function brandThemeColours(profile: Pick<BusinessProfile, 'brand'>): BrandThemeColours | null {
  const brand = profile.brand;
  if (!brand?.primary) return null;
  return { accent: brand.primary.toUpperCase(), text: (brand.text ?? NEUTRAL_TEXT).toUpperCase(), background: (brand.background ?? PAGE_BACKGROUND).toUpperCase() };
}

/**
 * What a theme looked like when SoloKit last wrote it from the brand: colours, font and layout. Names are left out on
 * purpose, so renaming a brand theme does not count as editing it.
 */
export function themeSignature(theme: Pick<InvoiceTheme, 'accent' | 'text' | 'background' | 'fontId' | 'layout'>): string {
  return [theme.accent, theme.text, theme.background, theme.fontId, theme.layout].map((part) => part.toUpperCase()).join('|');
}

export type BrandThemeState =
  /** No brand colours yet. */
  | { kind: 'none' }
  /** Brand colours, and no theme made from them (or the theme was deleted). */
  | { kind: 'create'; previouslyDeleted: boolean }
  /** The brand theme already matches the brand colours. */
  | { kind: 'current'; theme: InvoiceTheme }
  /** The brand colours changed and the theme is exactly as SoloKit left it, so it is safe to update. */
  | { kind: 'update'; theme: InvoiceTheme }
  /** The brand colours changed but the person edited the theme, so SoloKit will not overwrite it. */
  | { kind: 'edited'; theme: InvoiceTheme };

const sameColours = (theme: InvoiceTheme, colours: BrandThemeColours) =>
  theme.accent.toUpperCase() === colours.accent && theme.text.toUpperCase() === colours.text && theme.background.toUpperCase() === colours.background;

/** Where the brand theme stands, from the saved profile and the custom themes. */
export function brandThemeState(profile: Pick<BusinessProfile, 'brand' | 'brandTheme'>, customThemes: readonly InvoiceTheme[]): BrandThemeState {
  const colours = brandThemeColours(profile);
  if (!colours) return { kind: 'none' };
  const link = profile.brandTheme;
  const theme = link ? customThemes.find((candidate) => candidate.id === link.themeId) : undefined;
  if (!link || !theme) return { kind: 'create', previouslyDeleted: link !== undefined };
  if (sameColours(theme, colours)) return { kind: 'current', theme };
  return themeSignature(theme) === link.signature ? { kind: 'update', theme } : { kind: 'edited', theme };
}

export const BRAND_THEME_BASE_ID = 'modern';
export const BRAND_THEME_FONT: FontId = 'inter';

export class BrandThemeError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join(' '));
    this.name = 'BrandThemeError';
    this.problems = problems;
  }
}

export interface BrandThemeResult {
  theme: InvoiceTheme;
  profile: BusinessProfile;
  madeDefault: boolean;
}

export interface BrandThemeOptions {
  /** `create` makes a new theme (also when the old one was edited). `update` rewrites the linked theme's colours; it refuses an edited one. */
  mode: 'create' | 'update';
  makeDefault?: boolean;
  font?: FontId;
  makeId?: () => string;
}

/**
 * Writes the brand theme into the Business's themes and links it from the profile. It reads the saved profile and
 * themes itself, so it always works from what is on the device. Never overwrites a theme the person edited:
 * `update` throws {@link BrandThemeError} for one. Throws too when the colours would not be readable on a page.
 */
export async function applyBrandTheme(storage: InvoiceStorage, options: BrandThemeOptions): Promise<BrandThemeResult> {
  const [profile, themes] = await Promise.all([storage.profile.get(), storage.themes.list()]);
  if (!profile) throw new BrandThemeError(['Save your business details first.']);
  const colours = brandThemeColours(profile);
  if (!colours) throw new BrandThemeError(['Add brand colours first.']);
  const state = brandThemeState(profile, themes);

  let theme: InvoiceTheme;
  if (options.mode === 'update') {
    if (state.kind !== 'update' && state.kind !== 'current') throw new BrandThemeError(['The brand theme was changed by hand, so it is left as it is.']);
    theme = createCustomTheme(state.theme, colours, state.theme.id);
  } else {
    const base = PRESET_THEMES.find((preset) => preset.id === BRAND_THEME_BASE_ID) as InvoiceTheme;
    const taken = [...PRESET_THEMES, ...themes].map((existing) => existing.name);
    const name = uniqueThemeName(`${profile.name.trim() || 'My business'} brand`, taken);
    theme = createCustomTheme(base, { name, ...colours, fontId: options.font ?? BRAND_THEME_FONT }, (options.makeId ?? newId)());
  }
  const issues = validateTheme(theme);
  if (issues.length > 0) throw new BrandThemeError(issues.map((issue) => issue.message));

  await storage.themes.save(theme);
  const link: BrandThemeLink = { themeId: theme.id, signature: themeSignature(theme) };
  const saved: BusinessProfile = { ...profile, brandTheme: link };
  await storage.profile.save(saved);
  let madeDefault = false;
  if (options.makeDefault) {
    await storage.settings.update({ defaultThemeId: theme.id });
    madeDefault = true;
  }
  return { theme, profile: saved, madeDefault };
}

/** True when the theme is used for new documents (so a brand theme update changes how they print). */
export async function isDefaultTheme(storage: InvoiceStorage, themeId: string): Promise<boolean> {
  return (await storage.settings.get()).defaultThemeId === themeId;
}
