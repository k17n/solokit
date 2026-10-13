import { PRESET_THEMES, contrastRatio, type InvoiceTheme } from '@solokit/tool-invoice';
import { describe, expect, it } from 'vitest';
import { mixHex } from './colors';
import { paletteFor } from './sections';

const custom = (changes: Partial<InvoiceTheme>): InvoiceTheme => ({
  id: 'custom',
  name: 'Custom',
  layout: 'classic',
  accent: '#0B1B3A',
  text: '#1A1A1A',
  background: '#FFFFFF',
  fontId: 'inter',
  ...changes,
});

describe('paletteFor', () => {
  it('lifts muted text to 4.5:1 on the background and on the zebra tint', () => {
    const theme = custom({ text: '#4B5563', background: '#FFFFFF' });
    const palette = paletteFor(theme);
    expect(contrastRatio(palette.muted, palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.muted, mixHex(theme.accent, theme.background, 0.1))).toBeGreaterThanOrEqual(4.5);
  });

  it('lifts muted text for #767676 on white to the text colour itself, the most it can do', () => {
    // #767676 is only 4.54:1 on white, so no mix can reach 4.5:1 on a tinted zebra row: it stops at the text colour.
    const theme = custom({ text: '#767676', background: '#FFFFFF' });
    const palette = paletteFor(theme);
    expect(contrastRatio(palette.muted, palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(palette.muted).toBe('#767676');
  });

  it('uses the text colour for small accent text when the accent is too pale', () => {
    const palette = paletteFor(custom({ accent: '#949494' }));
    expect(palette.accentSmall).toBe(palette.text);
    expect(palette.accent).toBe('#949494');
  });

  it('keeps the accent for small text when it is legible', () => {
    const palette = paletteFor(custom({ accent: '#0B1B3A' }));
    expect(palette.accentSmall).toBe('#0B1B3A');
  });

  for (const preset of PRESET_THEMES) {
    it(`${preset.name}: keeps its accent for small text and never gets a lighter muted colour`, () => {
      const palette = paletteFor(preset);
      const passes =
        contrastRatio(preset.accent, preset.background) >= 4.5 &&
        contrastRatio(preset.accent, mixHex(preset.accent, preset.background, 0.14)) >= 4.5;
      // Modern's emerald (#047857) is 5.5:1 on white but only 4.4:1 on its own table-header tint.
      expect(passes).toBe(preset.id !== 'modern');
      expect(palette.accentSmall).toBe(passes ? preset.accent : preset.text);
      expect(contrastRatio(palette.muted, palette.bg)).toBeGreaterThanOrEqual(4.5);
      const before = mixHex(preset.text, preset.background, 0.62);
      expect(contrastRatio(palette.muted, palette.bg)).toBeGreaterThanOrEqual(contrastRatio(before, palette.bg));
    });
  }
});
