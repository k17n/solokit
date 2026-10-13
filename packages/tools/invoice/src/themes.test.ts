import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_ID,
  FONT_OPTIONS,
  PRESET_THEMES,
  contrastRatio,
  createCustomTheme,
  isPresetThemeId,
  resolveTheme,
  validateTheme,
} from './themes';

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });

  it('is symmetric and accepts lower-case hex', () => {
    expect(contrastRatio('#ffffff', '#0b1b3a')).toBeCloseTo(contrastRatio('#0B1B3A', '#FFFFFF'), 5);
  });
});

describe('preset themes', () => {
  it('has the six presets, with classic as the default', () => {
    expect(PRESET_THEMES.map((theme) => theme.id)).toEqual(['classic', 'modern', 'minimal', 'bold', 'consultant', 'formal']);
    expect(DEFAULT_THEME_ID).toBe('classic');
    expect(isPresetThemeId('modern')).toBe(true);
    expect(isPresetThemeId('mine')).toBe(false);
  });

  it('passes its own validation', () => {
    for (const theme of PRESET_THEMES) expect(validateTheme(theme), theme.id).toEqual([]);
  });

  it('uses a known layout and font for each preset', () => {
    const fontIds = FONT_OPTIONS.map((font) => font.id);
    for (const theme of PRESET_THEMES) {
      expect(theme.layout).toBe(theme.id);
      expect(fontIds).toContain(theme.fontId);
    }
  });
});

describe('font options', () => {
  it('offers sans, serif and mono fonts', () => {
    const groups = new Set(FONT_OPTIONS.map((font) => font.group));
    expect([...groups].sort()).toEqual(['mono', 'sans', 'serif']);
    expect(FONT_OPTIONS.map((font) => font.id)).toEqual(['inter', 'poppins', 'source-serif-4', 'inconsolata', 'geist-mono']);
  });
});

describe('validateTheme', () => {
  const base = PRESET_THEMES[0]!;

  it('rejects malformed colours', () => {
    const issues = validateTheme({ ...base, accent: 'blue', text: '#12', background: 'white' });
    expect(issues.map((issue) => issue.path)).toEqual(expect.arrayContaining(['accent', 'text', 'background']));
  });

  it('rejects text that is hard to read on the background', () => {
    const issues = validateTheme({ ...base, text: '#999999', background: '#FFFFFF' });
    expect(issues.map((issue) => issue.path)).toContain('text');
  });

  it('rejects an accent that disappears into the background', () => {
    const issues = validateTheme({ ...base, accent: '#F5F5F5', background: '#FFFFFF' });
    expect(issues.map((issue) => issue.path)).toContain('accent');
  });

  it('needs a dark enough accent for layouts with a coloured band behind white text', () => {
    const modern = PRESET_THEMES.find((theme) => theme.id === 'modern')!;
    // #3B82F6 is about 3.7:1 against white: visible on the page, but too light for white text on top of it.
    expect(validateTheme({ ...modern, accent: '#3B82F6' }).map((issue) => issue.path)).toContain('accent');
    expect(validateTheme({ ...base, accent: '#3B82F6' }).map((issue) => issue.path)).not.toContain('accent');
  });
});

describe('resolveTheme and createCustomTheme', () => {
  it('prefers a custom theme, then a preset, then the default', () => {
    const custom = createCustomTheme(PRESET_THEMES[1]!, { name: 'Mine', accent: '#0F766E' }, 'custom-1');
    expect(resolveTheme('custom-1', [custom])).toBe(custom);
    expect(resolveTheme('modern', [custom]).id).toBe('modern');
    expect(resolveTheme('gone', [custom]).id).toBe(DEFAULT_THEME_ID);
  });

  it('copies the layout from the base and applies the changes', () => {
    const modern = PRESET_THEMES.find((theme) => theme.id === 'modern')!;
    const custom = createCustomTheme(modern, { name: 'Teal', accent: '#0F766E', fontId: 'poppins' }, 'custom-2');
    expect(custom).toMatchObject({ id: 'custom-2', name: 'Teal', layout: 'modern', accent: '#0F766E', fontId: 'poppins', text: modern.text });
  });
});

describe('contrastRatio with saturated colours', () => {
  it('weights the red, green and blue channels correctly', () => {
    expect(contrastRatio('#FF0000', '#FFFFFF')).toBeCloseTo(3.998, 2);
    expect(contrastRatio('#0000FF', '#FFFFFF')).toBeCloseTo(8.592, 2);
    expect(contrastRatio('#00FF00', '#FFFFFF')).toBeCloseTo(1.372, 2);
  });
});
