import { describe, expect, it } from 'vitest';
import { quickActions, search } from './search';

const ids = (query: string) => search(query).map((item) => item.id);

describe('app home search', () => {
  it('finds nothing for an empty search', () => {
    expect(search('   ')).toEqual([]);
  });

  it('finds the quotation action by name, and by words people use', () => {
    expect(ids('quotation')[0]).toBe('new-quote');
    expect(ids('estimate')).toContain('new-quote');
  });

  it('finds both NDAs and the contract tool for "nda", actions first', () => {
    const found = ids('NDA');
    expect(found.slice(0, 2).sort()).toEqual(['new-nda-mutual', 'new-nda-one-way']);
    expect(found).toContain('tool-contract');
  });

  it('needs every word to match, ignoring case and punctuation', () => {
    expect(ids('one-way nda')).toEqual(['new-nda-one-way']);
    expect(ids('invoice zebra')).toEqual([]);
  });

  it('includes tools that are coming, after ready ones, with nowhere to go yet', () => {
    const found = search('timesheet');
    expect(found.map((item) => item.id)).toEqual(['tool-time-tracker']);
    expect(found[0]?.kind).toBe('soon');
    expect(found[0]?.href).toBeUndefined();
  });

  it('links actions to the tool, starting the document', () => {
    expect(quickActions().map((action) => action.href)).toEqual([
      '/app/invoice/?new=invoice',
      '/app/invoice/?new=quote',
      '/app/invoice/?new=proforma',
      '/app/contract/?new=nda-mutual',
      '/app/contract/?new=nda-one-way',
      '/app/contract/?new=services',
    ]);
  });
});
