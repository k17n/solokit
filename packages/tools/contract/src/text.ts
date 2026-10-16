/**
 * Characters that XML 1.0 (and so a Word file) cannot hold: C0 controls other than tab, line feed and carriage return.
 * Pasted text from Word or a PDF sometimes carries a vertical tab or form feed.
 */
export const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const XML_INVALID_ALL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export const hasControlCharacters = (text: string): boolean => XML_INVALID.test(text);

/** Vertical tab and form feed become a space (they mean "line break" in Word, and a space reads well inline); other control characters are dropped. */
export function cleanText(text: string): string {
  return text.replace(/[\u000B\u000C]/g, ' ').replace(XML_INVALID_ALL, '');
}

/** Returns a copy of any JSON-like value with {@link cleanText} applied to every string in it. */
export function cleanDeep<T>(value: T): T {
  if (typeof value === 'string') return cleanText(value) as T;
  if (Array.isArray(value)) return value.map((entry) => cleanDeep(entry)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, cleanDeep(entry)])) as T;
  }
  return value;
}

/**
 * Whether a character can be printed by the PDF fonts SoloKit bundles (Latin and Latin Extended, plus common punctuation
 * and the currency signs). This is deliberately conservative: a character outside it is reported, never silently dropped.
 */
export function isPrintableInPdf(codePoint: number): boolean {
  return (
    codePoint === 0x09 ||
    codePoint === 0x0a ||
    codePoint === 0x0d ||
    (codePoint >= 0x20 && codePoint <= 0x7e) ||
    codePoint === 0xa0 ||
    (codePoint >= 0xa1 && codePoint <= 0x17f) || // Latin-1 supplement, Latin Extended-A
    codePoint === 0x2013 || // en dash
    codePoint === 0x2014 || // em dash
    codePoint === 0x2018 ||
    codePoint === 0x2019 ||
    codePoint === 0x201c ||
    codePoint === 0x201d ||
    codePoint === 0x2022 || // bullet
    codePoint === 0x2026 || // ellipsis
    codePoint === 0x20b9 || // rupee sign
    codePoint === 0x20ac // euro sign
  );
}

/** The distinct characters in the text that the bundled PDF fonts cannot print, in order of first appearance. */
export function unprintableCharacters(text: string): string[] {
  const found = new Set<string>();
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (XML_INVALID.test(char)) continue; // reported separately, and removed before printing
    if (!isPrintableInPdf(code)) found.add(char);
  }
  return [...found];
}

/** "Some characters (X) will not print in the PDF; the Word version will show them." */
export function unprintableMessage(characters: readonly string[]): string {
  return `Some characters (${characters.join(' ')}) will not print in the PDF; the Word version will show them.`;
}
