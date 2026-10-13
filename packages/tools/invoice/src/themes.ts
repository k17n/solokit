import type { StoredRecord } from '@solokit/storage';
import type { Issue } from './validation';

export type FontId = 'inter' | 'poppins' | 'source-serif-4' | 'inconsolata' | 'geist-mono';

export interface FontOption {
  id: FontId;
  label: string;
  group: 'sans' | 'serif' | 'mono';
}

/** Every one of these contains the rupee sign and the euro, pound and dollar signs. */
export const FONT_OPTIONS: readonly FontOption[] = [
  { id: 'inter', label: 'Inter', group: 'sans' },
  { id: 'poppins', label: 'Poppins', group: 'sans' },
  { id: 'source-serif-4', label: 'Source Serif 4', group: 'serif' },
  { id: 'inconsolata', label: 'Inconsolata', group: 'mono' },
  { id: 'geist-mono', label: 'Geist Mono', group: 'mono' },
];

export type ThemeLayout = 'classic' | 'modern' | 'minimal' | 'bold' | 'consultant' | 'formal';

export interface InvoiceTheme extends StoredRecord {
  name: string;
  layout: ThemeLayout;
  /** Colours as #RRGGBB. */
  accent: string;
  text: string;
  background: string;
  fontId: FontId;
}

export const DEFAULT_THEME_ID = 'classic';

export const PRESET_THEMES: readonly InvoiceTheme[] = [
  { id: 'classic', name: 'Classic', layout: 'classic', accent: '#0B1B3A', text: '#1A1A1A', background: '#FFFFFF', fontId: 'source-serif-4' },
  { id: 'modern', name: 'Modern', layout: 'modern', accent: '#047857', text: '#14213D', background: '#FFFFFF', fontId: 'inter' },
  { id: 'minimal', name: 'Minimal', layout: 'minimal', accent: '#374151', text: '#111827', background: '#FFFFFF', fontId: 'geist-mono' },
  { id: 'bold', name: 'Bold', layout: 'bold', accent: '#0B1B3A', text: '#0B1B3A', background: '#FFFBF2', fontId: 'poppins' },
  { id: 'consultant', name: 'Consultant', layout: 'consultant', accent: '#0F766E', text: '#0F172A', background: '#FFFFFF', fontId: 'inter' },
  { id: 'formal', name: 'Formal', layout: 'formal', accent: '#1F2937', text: '#111827', background: '#FFFFFF', fontId: 'source-serif-4' },
];

export function isPresetThemeId(id: string): boolean {
  return PRESET_THEMES.some((theme) => theme.id === id);
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const BAND_LAYOUTS: readonly ThemeLayout[] = ['modern', 'bold', 'consultant'];

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two #RRGGBB colours (1 to 21). */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

export function validateTheme(theme: InvoiceTheme): Issue[] {
  const issues: Issue[] = [];
  const colours = [
    ['accent', theme.accent],
    ['text', theme.text],
    ['background', theme.background],
  ] as const;
  for (const [path, value] of colours) {
    if (!HEX.test(value)) issues.push({ path, message: 'Use a colour like #0B1B3A' });
  }
  if (issues.length > 0) return issues;

  if (contrastRatio(theme.text, theme.background) < 4.5) {
    issues.push({ path: 'text', message: 'Text is hard to read on this background. Pick a darker text colour or a lighter background.' });
  }
  if (contrastRatio(theme.accent, theme.background) < 3) {
    issues.push({ path: 'accent', message: 'The accent colour is too close to the background to see.' });
  } else if (BAND_LAYOUTS.includes(theme.layout) && contrastRatio('#FFFFFF', theme.accent) < 4.5) {
    issues.push({ path: 'accent', message: 'This layout puts white text on the accent colour. Pick a darker accent.' });
  }
  return issues;
}

export function resolveTheme(id: string, custom: readonly InvoiceTheme[]): InvoiceTheme {
  const found =
    custom.find((theme) => theme.id === id) ??
    PRESET_THEMES.find((theme) => theme.id === id) ??
    PRESET_THEMES.find((theme) => theme.id === DEFAULT_THEME_ID);
  return found as InvoiceTheme;
}

export type ThemeChanges = Partial<Pick<InvoiceTheme, 'name' | 'accent' | 'text' | 'background' | 'fontId'>>;

/** A custom theme keeps the base preset's layout and changes only colours and font. */
export function createCustomTheme(base: InvoiceTheme, changes: ThemeChanges, id: string): InvoiceTheme {
  return { ...base, ...changes, id };
}
