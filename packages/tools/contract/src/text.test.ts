import { describe, expect, it } from 'vitest';
import { cleanDeep, cleanText, hasControlCharacters, isPrintableInPdf, unprintableCharacters, unprintableMessage } from './text';

describe('cleanText', () => {
  it('turns vertical tab and form feed into a space and drops other control characters', () => {
    expect(cleanText('a\u000Bb\u000Cc\u0000d\u0008e\u001Ff')).toBe('a b cdef');
  });
  it('keeps tab, newline, carriage return and everything printable', () => {
    expect(cleanText('line\none\r\ntwo\tindented ₹ é 日本')).toBe('line\none\r\ntwo\tindented ₹ é 日本');
  });
  it('cleans every string inside nested data and leaves other values alone', () => {
    expect(cleanDeep({ a: 'x\u000By', list: ['p\u0001q', 3, null, true], nested: { s: 'ok' } })).toEqual({ a: 'x y', list: ['pq', 3, null, true], nested: { s: 'ok' } });
  });
  it('detects control characters', () => {
    expect(hasControlCharacters('fine\n\t')).toBe(false);
    expect(hasControlCharacters('bad\u000B')).toBe(true);
    expect(hasControlCharacters('bad\u0000')).toBe(true);
  });
});

describe('unprintableCharacters', () => {
  it('accepts Latin, Latin Extended, common punctuation and the rupee sign', () => {
    expect(unprintableCharacters('Asha Rao & Sons, José Müller, Łukasz, Ñandú – “quoted” … ₹ € • ‘x’')).toEqual([]);
  });
  it('lists each character the fonts cannot print once, in order', () => {
    expect(unprintableCharacters('Rao 日本 and श्री Ltd 日')).toEqual(['日', '本', 'श', '्', 'र', 'ी']);
  });
  it('does not count control characters as unprintable, since they are removed before printing', () => {
    expect(unprintableCharacters('a\u000Bb')).toEqual([]);
  });
  it('reports emoji as one character each', () => {
    expect(unprintableCharacters('Hi 😀')).toEqual(['😀']);
  });
  it('words the message the way the editor shows it', () => {
    expect(unprintableMessage(['日', '本'])).toBe('Some characters (日 本) will not print in the PDF; the Word version will show them.');
  });
  it('knows the allowlist edges', () => {
    expect(isPrintableInPdf(0x7f)).toBe(false);
    expect(isPrintableInPdf(0x17f)).toBe(true);
    expect(isPrintableInPdf(0x180)).toBe(false);
  });
});
