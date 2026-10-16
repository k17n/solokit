import { describe, expect, it } from 'vitest';
import { buildInvoiceDocument } from '@solokit/tool-invoice';
import { makeSeller } from '@solokit/tool-invoice/testing';
import { normaliseHex, sampleInvoice, uniqueThemeName } from './themeEditing';

describe('normaliseHex', () => {
  it('accepts hex colours with or without the hash and in short form', () => {
    expect(normaliseHex('#0b1b3a')).toBe('#0B1B3A');
    expect(normaliseHex(' 0b1b3a ')).toBe('#0B1B3A');
    expect(normaliseHex('#fa0')).toBe('#FFAA00');
  });
  it('rejects anything else', () => {
    for (const text of ['', 'red', '#12345', '#GGGGGG', '#1234567']) expect(normaliseHex(text)).toBeNull();
  });
});

describe('uniqueThemeName', () => {
  it('adds a number only when the name is taken', () => {
    expect(uniqueThemeName('Modern copy', ['Classic'])).toBe('Modern copy');
    expect(uniqueThemeName('Modern copy', ['modern copy'])).toBe('Modern copy 2');
    expect(uniqueThemeName('Modern copy', ['Modern copy', 'Modern copy 2'])).toBe('Modern copy 3');
  });
});

describe('sampleInvoice', () => {
  it('builds a valid invoice from the seller for any seller type', () => {
    for (const gstStatus of ['regular', 'composition', 'unregistered'] as const) {
      const invoice = sampleInvoice(makeSeller({ gstStatus }), 'modern', '2026-10-16');
      expect(invoice.themeId).toBe('modern');
      expect(invoice.status).toBe('issued');
      expect(buildInvoiceDocument(invoice).totals.length).toBeGreaterThan(0);
    }
  });
});
