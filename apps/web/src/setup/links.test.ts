import { describe, expect, it } from 'vitest';
import { isToolPath, readSetupQuery, returnLabel, safeReturnPath, setupHref } from './links';

describe('setup links', () => {
  it('builds the setup address with where to come back to and a step', () => {
    expect(setupHref()).toBe('/setup/');
    expect(setupHref('/tools/invoice/')).toBe('/setup/?next=%2Ftools%2Finvoice%2F');
    expect(setupHref('/tools/invoice/', 'defaults')).toBe('/setup/?next=%2Ftools%2Finvoice%2F&step=defaults');
  });

  it('only goes back to paths on this site', () => {
    expect(safeReturnPath('/tools/contract/')).toBe('/tools/contract/');
    expect(safeReturnPath('//evil.example/')).toBeNull();
    expect(safeReturnPath('https://evil.example/')).toBeNull();
    expect(safeReturnPath('/\\evil.example')).toBeNull();
    expect(safeReturnPath('')).toBeNull();
  });

  it('reads the query, ignoring unknown steps and unsafe paths', () => {
    expect(readSetupQuery('?next=%2Ftools%2Finvoice%2F&step=payments')).toEqual({ next: '/tools/invoice/', step: 'payments' });
    expect(readSetupQuery('?next=https%3A%2F%2Fevil.example&step=nope')).toEqual({ next: null, step: null });
  });

  it('names the page to return to', () => {
    expect(returnLabel('/tools/invoice/')).toBe('Invoice generator');
    expect(returnLabel('/tools/contract/')).toBe('Contract and NDA generator');
    expect(returnLabel('/business/')).toBe('Your business');
    expect(returnLabel('/app/')).toBe('your tools');
    expect(returnLabel('/app/?welcome=1')).toBe('your tools');
    expect(returnLabel('/privacy/')).toBe('where you were');
  });

  it('tells tools apart from other pages', () => {
    expect(isToolPath('/tools/invoice/')).toBe(true);
    expect(isToolPath('/app/')).toBe(false);
    expect(isToolPath('/business/')).toBe(false);
  });
});
