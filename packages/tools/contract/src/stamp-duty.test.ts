import { describe, expect, it } from 'vitest';
import { STAMP_DUTY_AS_OF, STAMP_DUTY_STATES, isKnownState, stampDutyNote } from './stamp-duty';

describe('stamp duty data', () => {
  it('lists every state and union territory once', () => {
    expect(STAMP_DUTY_STATES.filter((s) => s.kind === 'state')).toHaveLength(28);
    expect(STAMP_DUTY_STATES.filter((s) => s.kind === 'union-territory')).toHaveLength(8);
    expect(new Set(STAMP_DUTY_STATES.map((s) => s.name)).size).toBe(36);
    expect(isKnownState('Maharashtra')).toBe(true);
    expect(isKnownState('Narnia')).toBe(false);
  });

  it('claims nothing it could not verify: every state says verify, and the entries hold no amounts', () => {
    for (const state of STAMP_DUTY_STATES) {
      expect(state.commonlyRequired, state.name).toBe('verify');
      expect(state.method, state.name).toBe('verify');
      expect(Object.keys(state).sort(), state.name).toEqual(['commonlyRequired', 'kind', 'method', 'name']);
    }
  });

  it('gives a pointer note with an as-of date and no amounts', () => {
    const note = stampDutyNote('Karnataka');
    expect(note.asOf).toBe(STAMP_DUTY_AS_OF);
    expect(note.text).toContain('Verify for Karnataka');
    expect(note.text).toContain("Karnataka's stamp office");
    expect(note.text.replace(STAMP_DUTY_AS_OF, '')).not.toMatch(/\d|Rs|INR|%/);
  });

  it('copes with a missing or unknown state', () => {
    expect(stampDutyNote('').text).toContain("your state's stamp office");
    expect(stampDutyNote('Atlantis').commonlyRequired).toBe('verify');
  });
});
