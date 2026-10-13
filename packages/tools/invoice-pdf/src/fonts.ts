import { Font } from '@react-pdf/renderer';
import { FONT_OPTIONS } from '@solokit/tool-invoice';

export const FONT_WEIGHTS = [400, 700] as const;

let registeredBase: string | undefined;

/**
 * Removes the invoice font families from react-pdf's registry and forgets the base they came from. A font source
 * caches its load promise even when the download fails, so this is how a failed download is made retryable.
 * Deliberately not `Font.clear()`, which would also drop Helvetica and the hyphenation callback.
 */
export function resetInvoiceFonts(): void {
  const registry = Font.getRegisteredFonts();
  for (const font of FONT_OPTIONS) delete registry[font.id];
  registeredBase = undefined;
}

/**
 * Tells react-pdf where the invoice fonts are. `baseUrl` is a URL in the browser ("/fonts/invoice") or a
 * folder in tests. Safe to call repeatedly with the same base; a different base replaces the old one.
 */
export function registerInvoiceFonts(baseUrl: string): void {
  const base = baseUrl.replace(/[\/]+$/, '');
  if (registeredBase === base) return;
  if (registeredBase !== undefined) resetInvoiceFonts();
  for (const font of FONT_OPTIONS) {
    Font.register({
      family: font.id,
      fonts: FONT_WEIGHTS.map((weight) => ({ src: `${base}/${font.id}-${weight}.ttf`, fontWeight: weight })),
    });
  }
  // Keep normal words whole, but split long unbroken tokens (URLs, IDs) so they cannot run out of their column.
  Font.registerHyphenationCallback((word) => (word.length > 18 ? (word.match(/.{1,12}/g) ?? [word]) : [word]));
  registeredBase = base;
}
