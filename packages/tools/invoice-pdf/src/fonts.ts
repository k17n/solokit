import { Font } from '@react-pdf/renderer';
import { FONT_OPTIONS } from '@solokit/tool-invoice';

export const FONT_WEIGHTS = [400, 700] as const;

let registeredBase: string | undefined;

/**
 * Tells react-pdf where the invoice fonts are. `baseUrl` is a URL in the browser ("/fonts/invoice") or a
 * folder in tests. Safe to call repeatedly.
 */
export function registerInvoiceFonts(baseUrl: string): void {
  const base = baseUrl.replace(/[\\/]+$/, '');
  if (registeredBase === base) return;
  for (const font of FONT_OPTIONS) {
    Font.register({
      family: font.id,
      fonts: FONT_WEIGHTS.map((weight) => ({ src: `${base}/${font.id}-${weight}.ttf`, fontWeight: weight })),
    });
  }
  // Keep whole words together instead of breaking them with hyphens.
  Font.registerHyphenationCallback((word) => [word]);
  registeredBase = base;
}
