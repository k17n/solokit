import { contrastRatio } from '@solokit/profile';
import { describe, expect, it } from 'vitest';
import { mixHex, readableOn } from './colors';

describe('mixHex', () => {
  it('blends two colours', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mixHex('#FF0000', '#FFFFFF', 1)).toBe('#FF0000');
    expect(mixHex('#FF0000', '#FFFFFF', 0)).toBe('#FFFFFF');
    expect(mixHex('#0b1b3a', '#ffffff', 0.1)).toBe('#E7E8EB');
  });

  it('stays inside the colour range', () => {
    expect(mixHex('#FFFFFF', '#FFFFFF', 2)).toBe('#FFFFFF');
    expect(mixHex('#000000', '#000000', -1)).toBe('#000000');
  });
});

describe('readableOn', () => {
  it('picks white on dark backgrounds and near-black on light ones', () => {
    expect(readableOn('#000000')).toBe('#FFFFFF');
    expect(readableOn('#0B1B3A')).toBe('#FFFFFF');
    expect(readableOn('#047857')).toBe('#FFFFFF');
    expect(readableOn('#FFFFFF')).toBe('#111827');
    expect(readableOn('#FFFBF2')).toBe('#111827');
  });

  it('always gives readable contrast for the preset accents', () => {
    for (const accent of ['#0B1B3A', '#047857', '#374151', '#0F766E', '#1F2937']) {
      expect(contrastRatio(readableOn(accent), accent)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
