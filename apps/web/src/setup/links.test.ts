import { describe, expect, it } from 'vitest';
import { isToolPath, readSetupQuery, returnLabel, safeReturnPath, setupHref } from './links';

describe('setup links', () => {
  it('builds the setup address with where to come back to and a step', () => {
    expect(setupHref()).toBe('/app/setup/');
    expect(setupHref('/app/invoice/')).toBe('/app/setup/?next=%2Fapp%2Finvoice%2F');
    expect(setupHref('/app/invoice/', 'defaults')).toBe('/app/setup/?next=%2Fapp%2Finvoice%2F&step=defaults');
  });

  it('only goes back to paths on this site', () => {
    expect(safeReturnPath('/app/contract/')).toBe('/app/contract/');
    expect(safeReturnPath('//evil.example/')).toBeNull();
    expect(safeReturnPath('https://evil.example/')).toBeNull();
    expect(safeReturnPath('/\\evil.example')).toBeNull();
    expect(safeReturnPath('')).toBeNull();
  });

  it('reads the query, ignoring unknown steps and unsafe paths', () => {
    expect(readSetupQuery('?next=%2Fapp%2Finvoice%2F&step=payments')).toEqual({ next: '/app/invoice/', step: 'payments' });
    expect(readSetupQuery('?next=https%3A%2F%2Fevil.example&step=nope')).toEqual({ next: null, step: null });
  });

  it('names the page to return to', () => {
    expect(returnLabel('/app/invoice/')).toBe('Invoice generator');
    expect(returnLabel('/app/contract/')).toBe('Contract and NDA generator');
    expect(returnLabel('/app/business/')).toBe('Your business');
    expect(returnLabel('/app/')).toBe('your tools');
    expect(returnLabel('/app/?welcome=1')).toBe('your tools');
    expect(returnLabel('/privacy/')).toBe('where you were');
  });

  it('tells tools apart from other pages', () => {
    expect(isToolPath('/app/invoice/')).toBe(true);
    expect(isToolPath('/app/')).toBe(false);
    expect(isToolPath('/app/business/')).toBe(false);
    // The tool landing pages on the site are not the tools.
    expect(isToolPath('/tools/invoice/')).toBe(false);
  });
});
