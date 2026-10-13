import { PRESET_THEMES } from '@solokit/tool-invoice';
import { describe, expect, it } from 'vitest';
import { LAYOUTS } from './layouts';

describe('layout specs', () => {
  it('has a spec for every preset layout', () => {
    for (const theme of PRESET_THEMES) expect(LAYOUTS[theme.layout], theme.layout).toBeDefined();
    expect(Object.keys(LAYOUTS).sort()).toEqual(['bold', 'classic', 'consultant', 'formal', 'minimal', 'modern']);
  });

  it('gives the layouts distinct looks', () => {
    expect(LAYOUTS.classic.header).toBe('plain');
    expect(LAYOUTS.modern.header).toBe('band');
    expect(LAYOUTS.bold.header).toBe('band');
    expect(LAYOUTS.consultant.header).toBe('sidebar');
    expect(LAYOUTS.formal.header).toBe('centered');
    expect(LAYOUTS.minimal.uppercaseTitle).toBe(true);
    expect(LAYOUTS.formal.uppercaseTitle).toBe(true);
    expect(LAYOUTS.formal.rules).toBe('double');
    expect(LAYOUTS.modern.tableHeader).toBe('fill');
    expect(LAYOUTS.consultant.zebra).toBe(true);
  });

  it('uses sensible title sizes', () => {
    for (const spec of Object.values(LAYOUTS)) {
      expect(spec.titleSize).toBeGreaterThanOrEqual(14);
      expect(spec.titleSize).toBeLessThanOrEqual(32);
    }
  });
});
