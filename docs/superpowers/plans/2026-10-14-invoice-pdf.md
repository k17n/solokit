# Invoice PDF Engine Implementation Plan (Plan 3B of 3C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn an `InvoiceDocument` and an `InvoiceTheme` into a real PDF in the browser (and in Node for tests): bundled fonts that contain the rupee sign, six theme layouts, an optional logo, and a UPI QR code. No screens yet.

**Architecture:** A new package `packages/tools/invoice-pdf` (`@solokit/tool-invoice-pdf`) built on `@react-pdf/renderer`. The font files are generated once, at development time, by a script in `apps/web` into `apps/web/public/fonts/invoice/` (committed, served and precached like the app icons). `registerInvoiceFonts(baseUrl)` points react-pdf at them. `InvoicePdf` composes small section components driven by a per-layout `LayoutSpec`. `renderInvoicePdf` builds the document view-model, makes the QR image and returns a `Blob`. Tests render real PDFs and read the text back with `pdfjs-dist`, which proves glyphs such as ₹ really made it into the file.

**Tech Stack:** `@react-pdf/renderer` 4.9, React 19, `qrcode`, `subset-font` and `@expo-google-fonts/*` (development only), `fontkit` and `pdfjs-dist` (tests only), Vitest.

## Plan roadmap

1. Plan 3A (merged): invoice domain.
2. Plan 3B (this plan): PDF engine, fonts, layouts, QR.
3. Plan 3C: the screens (onboarding, profile, editor, live preview, themes and logo, saved invoices, backup UI, registry flip).

## Global Constraints

- Invoice fonts: **Inter, Poppins (sans); Source Serif 4 (serif); IBM Plex Mono, Geist Mono (mono)**, regular (400) and bold (700). Every file must contain ₹ € £ $ and accented Latin-ext letters (`é Ł ž`). The ids are those of `FONT_OPTIONS` in `@solokit/tool-invoice`.
- Font licensing (SIL OFL 1.1): ship each family's licence text and copyright in `THIRD_PARTY_LICENSES.txt` next to the fonts. **IBM Plex Mono declares a Reserved Font Name ("Plex"), so it is shipped UNMODIFIED; the other four are subset** (subsetting is a modification, allowed for fonts without a reserved name when the licence travels with them).
- Latin + Latin-ext only. Currency symbols supported: ₹ € £ $.
- Presets and layouts: classic, modern, minimal, bold, consultant, formal. Theme customisation is colours plus font only; layout is fixed per preset.
- The PDF must show: title, invoice number, dates, seller block (logo, address, GSTIN/PAN), client block, place of supply, line table (HSN/SAC code, quantity with unit, rate, discount, GST rate and tax only when shown), totals rows with emphasis, amount in words, bank details, UPI QR (INR only), declarations, notes, terms, a signature block ("Authorised signatory"), page numbers, and a DRAFT or CANCELLED watermark when the invoice is not issued.
- A4 only for now. Images in react-pdf must be PNG or JPEG data URLs (no SVG); the logo conversion belongs to Plan 3C.
- No requests to third parties: fonts are fetched from the site itself.
- Tax text stays factual; this package only presents what `buildInvoiceDocument` produced.

## File Structure

```
apps/web/
  package.json                     (modify: dev dependencies + "fonts" script)
  scripts/build-invoice-fonts.mjs  (new)
  public/fonts/invoice/            (generated, committed)
    <font-id>-400.ttf  <font-id>-700.ttf  (x5)   THIRD_PARTY_LICENSES.txt
packages/tools/invoice/
  package.json                     (modify: "./testing" export)
packages/tools/invoice-pdf/
  package.json  tsconfig.json  vitest.config.ts
  src/
    index.ts
    testing.ts                     (test helpers; not exported)
    fonts.ts            fonts.test.ts          (glyph coverage of the files)
    fonts-render.test.ts                       (fonts through real PDFs)
    qr.ts               qr.test.ts
    colors.ts           colors.test.ts
    layouts.ts          layouts.test.ts
    sections.tsx
    InvoicePdf.tsx      invoice-pdf.test.tsx
    render.tsx          render.test.tsx
    samples.test.tsx                           (writes sample PDFs only when SAMPLES_DIR is set)
```

---

### Task 1: Package scaffold, font build script and the generated fonts

**Files:**
- Modify: `packages/tools/invoice/package.json` (add the `./testing` export)
- Create: `packages/tools/invoice-pdf/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/testing.ts`, `src/index.ts`
- Modify: `apps/web/package.json`
- Create: `apps/web/scripts/build-invoice-fonts.mjs`
- Generate and commit: `apps/web/public/fonts/invoice/*`
- Test: `packages/tools/invoice-pdf/src/fonts.test.ts`

**Interfaces:**
- Produces: `@solokit/tool-invoice/testing` (exports `makeSeller`, `makeClient`, `makeInvoice`); font files `<id>-400.ttf` and `<id>-700.ttf` for `inter`, `poppins`, `source-serif-4`, `ibm-plex-mono`, `geist-mono`; `THIRD_PARTY_LICENSES.txt`; `FONT_DIR` and `extractPdfText(data): Promise<string[]>` in `src/testing.ts`.

- [ ] **Step 1: Export the test fixtures from the invoice package**

In `packages/tools/invoice/package.json` change `exports` to:
```json
  "exports": {
    ".": "./src/index.ts",
    "./testing": "./src/testing.ts"
  },
```

- [ ] **Step 2: Create the PDF package files**

`packages/tools/invoice-pdf/package.json`:
```json
{
  "name": "@solokit/tool-invoice-pdf",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@react-pdf/renderer": "^4.9.0",
    "@solokit/tool-invoice": "workspace:*",
    "qrcode": "^1.5.4",
    "react": "^19.3.0"
  },
  "devDependencies": {
    "@types/qrcode": "^1.5.0",
    "@types/react": "^19.3.0",
    "fontkit": "^2.0.4",
    "pdfjs-dist": "^6.4.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/tools/invoice-pdf/tsconfig.json`:
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

`packages/tools/invoice-pdf/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 60_000,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

`packages/tools/invoice-pdf/src/index.ts` (temporary, filled in by later tasks):
```ts
export {};
```

`packages/tools/invoice-pdf/src/testing.ts`:
```ts
import { fileURLToPath } from 'node:url';

/** Where the generated invoice fonts live (served by the web app at /fonts/invoice). */
export const FONT_DIR = fileURLToPath(new URL('../../../../apps/web/public/fonts/invoice', import.meta.url));

/** The text on every page of a PDF, with whitespace collapsed. */
export async function extractPdfText(data: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // pdf.js takes ownership of the buffer it is given, so hand it a copy.
  const document = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    pages.push(text.replace(/\s+/g, ' ').trim());
  }
  return pages;
}
```
If TypeScript cannot find types for the `pdfjs-dist/legacy/build/pdf.mjs` import or for `fontkit`, add a minimal `src/types.d.ts` with `declare module` lines for them (keep it as small as the tests need) instead of changing the code.

- [ ] **Step 3: Add the font tooling to the web app**

In `apps/web/package.json` add to `devDependencies` (keep the list alphabetical):
```json
    "@expo-google-fonts/geist-mono": "^0.4.3",
    "@expo-google-fonts/ibm-plex-mono": "^0.4.1",
    "@expo-google-fonts/inter": "^0.4.2",
    "@expo-google-fonts/poppins": "^0.4.1",
    "@expo-google-fonts/source-serif-4": "^0.4.2",
    "fontkit": "^2.0.4",
    "subset-font": "^2.9.0",
```
and to `scripts`:
```json
    "fonts": "node scripts/build-invoice-fonts.mjs",
```

- [ ] **Step 4: Write the font build script**

`apps/web/scripts/build-invoice-fonts.mjs`:
```js
// Builds the invoice fonts. Run with: pnpm --filter @solokit/web fonts
// Each family gets regular (400) and bold (700) TTF files that contain Latin, Latin-ext and currency symbols
// (including the rupee sign) in ONE file, because react-pdf takes a single file per weight.
// IBM Plex Mono declares a Reserved Font Name ("Plex"), so it is copied UNMODIFIED; the others are subset.
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import subsetFont from 'subset-font';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'fonts', 'invoice');
mkdirSync(outDir, { recursive: true });

const FAMILIES = [
  { id: 'inter', pkg: 'inter', file: 'Inter', label: 'Inter', reservedName: false },
  { id: 'poppins', pkg: 'poppins', file: 'Poppins', label: 'Poppins', reservedName: false },
  { id: 'source-serif-4', pkg: 'source-serif-4', file: 'SourceSerif4', label: 'Source Serif 4', reservedName: false },
  { id: 'ibm-plex-mono', pkg: 'ibm-plex-mono', file: 'IBMPlexMono', label: 'IBM Plex Mono', reservedName: true },
  { id: 'geist-mono', pkg: 'geist-mono', file: 'GeistMono', label: 'Geist Mono', reservedName: false },
];
const WEIGHTS = [
  { weight: 400, folder: '400Regular' },
  { weight: 700, folder: '700Bold' },
];
const RANGES = [
  [0x20, 0x7e], // Basic Latin
  [0xa0, 0xff], // Latin-1 Supplement
  [0x100, 0x24f], // Latin Extended-A and B
  [0x2010, 0x2027], // dashes, quotes, bullets
  [0x2030, 0x203a], // per mille, guillemets
  [0x20a0, 0x20bf], // currency symbols, including the rupee sign
  [0x2116, 0x2116],
  [0x2122, 0x2122],
  [0x2212, 0x2212], // minus sign
];
let characters = '';
for (const [from, to] of RANGES) for (let code = from; code <= to; code++) characters += String.fromCodePoint(code);

const licenceParts = [
  'Fonts used for invoice PDFs. All are licensed under the SIL Open Font License 1.1.',
  'IBM Plex Mono is distributed unmodified (its licence reserves the name "Plex"); the other fonts are subset to',
  'Latin, Latin-ext and currency symbols, and keep their original names.',
  '',
];

for (const family of FAMILIES) {
  const packageDir = dirname(require.resolve(`@expo-google-fonts/${family.pkg}/package.json`));
  let copyright = '';
  for (const { weight, folder } of WEIGHTS) {
    const source = join(packageDir, folder, `${family.file}_${folder}.ttf`);
    const target = join(outDir, `${family.id}-${weight}.ttf`);
    const original = readFileSync(source);
    copyright = fontkit.create(original).copyright ?? copyright;
    if (family.reservedName) {
      copyFileSync(source, target);
    } else {
      const subset = await subsetFont(original, characters, { targetFormat: 'truetype' });
      writeFileSync(target, Buffer.from(subset));
    }
    console.log(`wrote ${family.id}-${weight}.ttf${family.reservedName ? ' (unmodified)' : ''}`);
  }
  licenceParts.push(`==== ${family.label} ====`, copyright.trim(), '', readFileSync(join(packageDir, 'LICENSE_FONT'), 'utf8').trim(), '', '');
}
writeFileSync(join(outDir, 'THIRD_PARTY_LICENSES.txt'), licenceParts.join('\n'));
console.log('wrote THIRD_PARTY_LICENSES.txt');
```

- [ ] **Step 5: Write the failing font test**

`packages/tools/invoice-pdf/src/fonts.test.ts`:
```ts
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as fontkit from 'fontkit';
import { FONT_OPTIONS } from '@solokit/tool-invoice';
import { describe, expect, it } from 'vitest';
import { FONT_DIR } from './testing';

const REQUIRED = ['₹', '€', '£', '$', 'é', 'Ł', 'ž'];
const WEIGHTS = [400, 700];

describe('bundled invoice fonts', () => {
  it('has a file for every font option and weight', () => {
    for (const font of FONT_OPTIONS) {
      for (const weight of WEIGHTS) {
        expect(existsSync(join(FONT_DIR, `${font.id}-${weight}.ttf`)), `${font.id}-${weight}`).toBe(true);
      }
    }
  });

  it('contains the rupee, euro, pound and dollar signs and accented Latin letters in every file', () => {
    for (const font of FONT_OPTIONS) {
      for (const weight of WEIGHTS) {
        const file = join(FONT_DIR, `${font.id}-${weight}.ttf`);
        const parsed = fontkit.create(readFileSync(file)) as fontkit.Font;
        const missing = REQUIRED.filter((character) => !parsed.hasGlyphForCodePoint(character.codePointAt(0) as number));
        expect(missing, `${font.id}-${weight} is missing ${missing.join(' ')}`).toEqual([]);
      }
    }
  });

  it('keeps every file small enough to precache', () => {
    for (const font of FONT_OPTIONS) {
      for (const weight of WEIGHTS) {
        const bytes = statSync(join(FONT_DIR, `${font.id}-${weight}.ttf`)).size;
        expect(bytes, `${font.id}-${weight}`).toBeLessThan(300 * 1024);
      }
    }
  });

  it('ships each family with its licence and copyright', () => {
    const licences = readFileSync(join(FONT_DIR, 'THIRD_PARTY_LICENSES.txt'), 'utf8');
    for (const label of ['Inter', 'Poppins', 'Source Serif 4', 'IBM Plex Mono', 'Geist Mono']) {
      expect(licences).toContain(`==== ${label} ====`);
    }
    expect(licences.match(/SIL OPEN FONT LICENSE Version 1\.1/g)?.length).toBe(5);
    expect(licences).toContain('Copyright');
  });

  it('keeps IBM Plex Mono unmodified because its licence reserves the name', () => {
    const licences = readFileSync(join(FONT_DIR, 'THIRD_PARTY_LICENSES.txt'), 'utf8');
    expect(licences).toContain('Reserved Font Name "Plex"');
    const parsed = fontkit.create(readFileSync(join(FONT_DIR, 'ibm-plex-mono-400.ttf'))) as fontkit.Font;
    expect(parsed.familyName).toBe('IBM Plex Mono');
    // The unmodified font still has its full set of glyphs, far more than the Latin subset.
    expect(parsed.numGlyphs).toBeGreaterThan(900);
  });
});
```

- [ ] **Step 6: Install, run the test to see it fail, generate the fonts, run it again**

Run: `pnpm install`
Expected: exits 0 (if pnpm asks to approve a build script, run `pnpm approve-builds` for that package only if it is one of the new dependencies; none of them should need one).
Run: `pnpm --filter @solokit/tool-invoice-pdf test`
Expected: FAIL (the font files do not exist yet).
Run: `pnpm --filter @solokit/web fonts`
Expected: ten `wrote ...ttf` lines (IBM Plex Mono marked unmodified) and `wrote THIRD_PARTY_LICENSES.txt`.
Run: `pnpm --filter @solokit/tool-invoice-pdf test`
Expected: PASS (5 tests).
Run: `pnpm --filter @solokit/tool-invoice-pdf typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(invoice-pdf): add package scaffold and bundled invoice fonts

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(Stage with explicit paths if `.superpowers/` or other local files show up in `git status`.)

---

### Task 2: Font registration, proven through real PDFs

**Files:**
- Create: `packages/tools/invoice-pdf/src/fonts.ts`
- Modify: `src/index.ts`
- Test: `src/fonts-render.test.tsx`

**Interfaces:**
- Consumes: `FONT_OPTIONS`, `FontId` from `@solokit/tool-invoice`; `Font` from `@react-pdf/renderer`.
- Produces: `FONT_WEIGHTS = [400, 700]`, `registerInvoiceFonts(baseUrl: string): void` (registers every family once per base URL; also turns off hyphenation so words never break in the middle). In the browser the base URL is `/fonts/invoice`; in tests it is `FONT_DIR`.

- [ ] **Step 1: Write the failing test**

`packages/tools/invoice-pdf/src/fonts-render.test.tsx`:
```tsx
import { Document, Page, Text, renderToBuffer } from '@react-pdf/renderer';
import { FONT_OPTIONS } from '@solokit/tool-invoice';
import { beforeAll, describe, expect, it } from 'vitest';
import { FONT_WEIGHTS, registerInvoiceFonts } from './fonts';
import { FONT_DIR, extractPdfText } from './testing';

beforeAll(() => registerInvoiceFonts(FONT_DIR));

describe('registerInvoiceFonts', () => {
  it('knows the two weights', () => {
    expect([...FONT_WEIGHTS]).toEqual([400, 700]);
  });

  it('can be called more than once with the same base', () => {
    expect(() => {
      registerInvoiceFonts(FONT_DIR);
      registerInvoiceFonts(FONT_DIR);
    }).not.toThrow();
  });

  for (const font of FONT_OPTIONS) {
    it(`puts the rupee sign and other currency symbols into a real PDF using ${font.label}`, async () => {
      const buffer = await renderToBuffer(
        <Document>
          <Page size="A4" style={{ fontFamily: font.id, padding: 40 }}>
            <Text>Total ₹ 1,18,000.00 € 12.50 £ 3 $ 4</Text>
            <Text style={{ fontWeight: 700 }}>Bold ₹ 84,960.00 Łódź café</Text>
          </Page>
        </Document>,
      );
      expect(Buffer.from(buffer).subarray(0, 5).toString()).toBe('%PDF-');
      const [page] = await extractPdfText(buffer);
      expect(page).toContain('Total ₹ 1,18,000.00 € 12.50 £ 3 $ 4');
      expect(page).toContain('Bold ₹ 84,960.00 Łódź café');
    });
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tool-invoice-pdf test -- fonts-render`
Expected: FAIL (cannot resolve `./fonts`).

- [ ] **Step 3: Implement**

`packages/tools/invoice-pdf/src/fonts.ts`:
```ts
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
```

- [ ] **Step 4: Export, run tests and typecheck**

Replace `packages/tools/invoice-pdf/src/index.ts` with:
```ts
export * from './fonts';
```
Run: `pnpm --filter @solokit/tool-invoice-pdf test`
Expected: PASS (fonts 5, fonts-render 7).
Run: `pnpm --filter @solokit/tool-invoice-pdf typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(invoice-pdf): register the bundled fonts and prove the rupee sign renders

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: UPI QR image

**Files:**
- Create: `packages/tools/invoice-pdf/src/qr.ts`
- Modify: `src/index.ts`
- Test: `src/qr.test.ts`

**Interfaces:**
- Produces: `buildQrDataUrl(payload: string, size?: number): Promise<string>` returning a PNG data URL (`data:image/png;base64,...`). Default size 240 px, no quiet-zone margin (the PDF draws its own spacing), error correction M. Throws for an empty payload.

- [ ] **Step 1: Write the failing test**

`packages/tools/invoice-pdf/src/qr.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildQrDataUrl } from './qr';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function decode(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
}

describe('buildQrDataUrl', () => {
  it('returns a PNG data URL', async () => {
    const url = await buildQrDataUrl('upi://pay?pa=asha@okhdfc&pn=Asha&am=100.00&cu=INR');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    expect([...decode(url).subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  });

  it('is deterministic and depends on the payload', async () => {
    const a = await buildQrDataUrl('upi://pay?pa=a@upi&am=1.00');
    const b = await buildQrDataUrl('upi://pay?pa=a@upi&am=1.00');
    const c = await buildQrDataUrl('upi://pay?pa=a@upi&am=2.00');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('honours the requested size', async () => {
    const png = decode(await buildQrDataUrl('hello', 120));
    // The PNG header stores the width and height at bytes 16 to 24.
    expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(100);
    expect(png.readUInt32BE(16)).toBeLessThanOrEqual(140);
    expect(png.readUInt32BE(20)).toBe(png.readUInt32BE(16));
  });

  it('rejects an empty payload', async () => {
    await expect(buildQrDataUrl('')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tool-invoice-pdf test -- qr`
Expected: FAIL (cannot resolve `./qr`).

- [ ] **Step 3: Implement**

`packages/tools/invoice-pdf/src/qr.ts`:
```ts
import QRCode from 'qrcode';

/** A QR code as a PNG data URL. react-pdf draws it with <Image>. */
export function buildQrDataUrl(payload: string, size = 240): Promise<string> {
  return QRCode.toDataURL(payload, { margin: 0, width: size, errorCorrectionLevel: 'M', type: 'image/png' });
}
```

- [ ] **Step 4: Export, run tests and typecheck**

Append to `packages/tools/invoice-pdf/src/index.ts`:
```ts
export * from './qr';
```
Run: `pnpm --filter @solokit/tool-invoice-pdf test` then `pnpm --filter @solokit/tool-invoice-pdf typecheck`
Expected: PASS and no type errors. (If the PNG width is outside 100 to 140 px for size 120, report the actual width instead of loosening the test blindly.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(invoice-pdf): add UPI QR image builder

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Colour helpers and layout specs

**Files:**
- Create: `packages/tools/invoice-pdf/src/colors.ts`, `src/layouts.ts`
- Modify: `src/index.ts`
- Test: `src/colors.test.ts`, `src/layouts.test.ts`

**Interfaces:**
- Produces:
  - `mixHex(a: string, b: string, weightA: number): string` (`weightA` of colour `a` over colour `b`, as upper-case `#RRGGBB`)
  - `readableOn(background: string): string` (`#FFFFFF` or `#111827`, whichever contrasts more)
  - `interface LayoutSpec { header: 'plain' | 'band' | 'centered' | 'sidebar'; titleAlign...` as below, and `LAYOUTS: Record<ThemeLayout, LayoutSpec>`

- [ ] **Step 1: Write the failing tests**

`packages/tools/invoice-pdf/src/colors.test.ts`:
```ts
import { contrastRatio } from '@solokit/tool-invoice';
import { describe, expect, it } from 'vitest';
import { mixHex, readableOn } from './colors';

describe('mixHex', () => {
  it('blends two colours', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mixHex('#FF0000', '#FFFFFF', 1)).toBe('#FF0000');
    expect(mixHex('#FF0000', '#FFFFFF', 0)).toBe('#FFFFFF');
    expect(mixHex('#0b1b3a', '#ffffff', 0.1)).toBe('#E7E8EB');
  });

  it('stays inside the colour range', () => {
    expect(mixHex('#FFFFFF', '#FFFFFF', 2)).toBe('#FFFFFF');
    expect(mixHex('#000000', '#000000', -1)).toBe('#000000');
  });
});

describe('readableOn', () => {
  it('picks white on dark backgrounds and near-black on light ones', () => {
    expect(readableOn('#000000')).toBe('#FFFFFF');
    expect(readableOn('#0B1B3A')).toBe('#FFFFFF');
    expect(readableOn('#047857')).toBe('#FFFFFF');
    expect(readableOn('#FFFFFF')).toBe('#111827');
    expect(readableOn('#FFFBF2')).toBe('#111827');
  });

  it('always gives readable contrast for the preset accents', () => {
    for (const accent of ['#0B1B3A', '#047857', '#374151', '#0F766E', '#1F2937']) {
      expect(contrastRatio(readableOn(accent), accent)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
```
`packages/tools/invoice-pdf/src/layouts.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tool-invoice-pdf test -- colors layouts`
Expected: FAIL (cannot resolve `./colors` and `./layouts`).

- [ ] **Step 3: Implement**

`packages/tools/invoice-pdf/src/colors.ts`:
```ts
import { contrastRatio } from '@solokit/tool-invoice';

function parse(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function toHex(value: number): string {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
}

/** `weightA` of colour `a` over colour `b`, as upper-case #RRGGBB. */
export function mixHex(a: string, b: string, weightA: number): string {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const mix = (x: number, y: number) => x * weightA + y * (1 - weightA);
  return `#${toHex(mix(ar, br))}${toHex(mix(ag, bg))}${toHex(mix(ab, bb))}`.toUpperCase();
}

/** White or near-black text, whichever reads better on the background. */
export function readableOn(background: string): string {
  return contrastRatio('#FFFFFF', background) >= contrastRatio('#111827', background) ? '#FFFFFF' : '#111827';
}
```

`packages/tools/invoice-pdf/src/layouts.ts`:
```ts
import type { ThemeLayout } from '@solokit/tool-invoice';

export interface LayoutSpec {
  /** plain: seller left, title right. band: full-width coloured band. centered: title centred between rules. sidebar: coloured edge strip. */
  header: 'plain' | 'band' | 'centered' | 'sidebar';
  uppercaseTitle: boolean;
  titleSize: number;
  /** line: accent text over an accent rule. fill: white text on an accent fill. tint: accent text on a light tint. */
  tableHeader: 'line' | 'fill' | 'tint';
  zebra: boolean;
  rules: 'single' | 'double' | 'none';
  /** Draw the grand total inside a tinted box. */
  totalsBox: boolean;
  /** Draw a thin border around the "bill to" block. */
  partiesBox: boolean;
}

export const LAYOUTS: Record<ThemeLayout, LayoutSpec> = {
  classic: { header: 'plain', uppercaseTitle: false, titleSize: 22, tableHeader: 'line', zebra: false, rules: 'single', totalsBox: false, partiesBox: false },
  modern: { header: 'band', uppercaseTitle: false, titleSize: 24, tableHeader: 'fill', zebra: true, rules: 'none', totalsBox: false, partiesBox: false },
  minimal: { header: 'plain', uppercaseTitle: true, titleSize: 14, tableHeader: 'line', zebra: false, rules: 'single', totalsBox: false, partiesBox: false },
  bold: { header: 'band', uppercaseTitle: false, titleSize: 30, tableHeader: 'fill', zebra: false, rules: 'none', totalsBox: true, partiesBox: false },
  consultant: { header: 'sidebar', uppercaseTitle: false, titleSize: 22, tableHeader: 'tint', zebra: true, rules: 'none', totalsBox: true, partiesBox: false },
  formal: { header: 'centered', uppercaseTitle: true, titleSize: 18, tableHeader: 'line', zebra: false, rules: 'double', totalsBox: false, partiesBox: true },
};
```

- [ ] **Step 4: Export, run tests and typecheck**

Append to `packages/tools/invoice-pdf/src/index.ts`:
```ts
export * from './colors';
export * from './layouts';
```
Run: `pnpm --filter @solokit/tool-invoice-pdf test` then `pnpm --filter @solokit/tool-invoice-pdf typecheck`
Expected: PASS and no type errors. If a hand-computed `mixHex` value in the tests is off by one in a channel, report the actual value and which channel; do not silently change the code.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(invoice-pdf): add colour helpers and per-layout specs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The invoice PDF component

**Files:**
- Create: `packages/tools/invoice-pdf/src/sections.tsx`, `src/InvoicePdf.tsx`
- Modify: `src/index.ts`
- Test: `src/invoice-pdf.test.tsx`

**Interfaces:**
- Consumes: `InvoiceDocument`, `InvoiceTheme` from `@solokit/tool-invoice`; `LAYOUTS`, `LayoutSpec`; `mixHex`, `readableOn`.
- Produces: `InvoicePdfProps { doc: InvoiceDocument; theme: InvoiceTheme; qrDataUrl?: string }`; component `InvoicePdf` rendering a `<Document>` with one A4 `<Page>` that flows onto more pages as needed. Section components in `sections.tsx`: `Header`, `PartiesBlock`, `LinesTable`, `SummaryBlock`, `PaymentBlock`, `NotesBlock`, `SignatoryBlock`, `PageFooter`, `Watermark`; `paletteFor(theme)`.

- [ ] **Step 1: Write the failing tests**

`packages/tools/invoice-pdf/src/invoice-pdf.test.tsx`:
```tsx
import { renderToBuffer } from '@react-pdf/renderer';
import { PRESET_THEMES, buildInvoiceDocument, type InvoiceRecord } from '@solokit/tool-invoice';
import { makeClient, makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { beforeAll, describe, expect, it } from 'vitest';
import { InvoicePdf } from './InvoicePdf';
import { registerInvoiceFonts } from './fonts';
import { buildQrDataUrl } from './qr';
import { FONT_DIR, extractPdfText } from './testing';

beforeAll(() => registerInvoiceFonts(FONT_DIR));

async function render(invoice: InvoiceRecord = makeInvoice(), themeId = 'classic', qrDataUrl?: string) {
  const theme = PRESET_THEMES.find((candidate) => candidate.id === themeId);
  if (!theme) throw new Error(`Unknown theme ${themeId}`);
  const buffer = await renderToBuffer(
    <InvoicePdf doc={buildInvoiceDocument(invoice)} theme={theme} {...(qrDataUrl ? { qrDataUrl } : {})} />,
  );
  return { buffer, pages: await extractPdfText(buffer) };
}

// Letter-spaced upper-case titles can come back with gaps between letters, so compare without whitespace.
const squash = (text: string) => text.replace(/\s+/g, '').toLowerCase();

describe('InvoicePdf: every layout carries the same invoice', () => {
  for (const theme of PRESET_THEMES) {
    it(`${theme.name} shows the invoice, parties, lines, totals and signature`, async () => {
      const { buffer, pages } = await render(makeInvoice(), theme.id);
      expect(Buffer.from(buffer).subarray(0, 5).toString()).toBe('%PDF-');
      expect(pages).toHaveLength(1);
      const text = pages[0] as string;
      expect(squash(text)).toContain('taxinvoice');
      for (const expected of [
        '2026-27/0001',
        '14 Oct 2026',
        'Asha Rao Consulting',
        'GSTIN: 27AAPFU0939F1ZV',
        'Northwind Traders',
        'Maharashtra',
        'Consulting',
        '998312',
        '24 hrs',
        '₹3,000.00',
        '₹72,000.00',
        'CGST @9%',
        'SGST @9%',
        '₹84,960.00',
        'Eighty-Four Thousand Nine Hundred Sixty Rupees Only',
        'For Asha Rao Consulting',
        'Authorised signatory',
      ]) {
        expect(text, `${theme.id}: ${expected}`).toContain(expected);
      }
    });
  }
});

describe('InvoicePdf: content variations', () => {
  it('shows bank details and the UPI caption, and embeds a QR image when given one', async () => {
    const qr = await buildQrDataUrl('upi://pay?pa=asha@okhdfc&pn=Asha&am=84960.00&cu=INR');
    const withQr = await render(makeInvoice(), 'classic', qr);
    const without = await render(makeInvoice(), 'classic');
    const text = withQr.pages[0] as string;
    for (const expected of ['Account number', '123456789012', 'IFSC', 'HDFC0001234', 'asha@okhdfc']) {
      expect(text, expected).toContain(expected);
    }
    expect(withQr.buffer.length).toBeGreaterThan(without.buffer.length);
  });

  it('shows TDS, the net payable and the TDS declaration', async () => {
    const { pages } = await render(makeInvoice({ tds: { ratePercent: 10 } }), 'modern');
    const text = pages[0] as string;
    expect(text).toContain('TDS @10% (deducted by client)');
    expect(text).toContain('-₹7,200.00');
    expect(text).toContain('Net payable');
    expect(text).toContain('₹77,760.00');
    expect(text).toContain('TDS at 10% is expected to be deducted by the client');
  });

  it('leaves out the tax columns for an unregistered seller and says so', async () => {
    const invoice = makeInvoice({
      seller: makeSeller({ gstStatus: 'unregistered', gstin: undefined }),
      placeOfSupplyStateCode: undefined,
      lines: [{ id: 'a', description: 'Logo design', quantity: 1, unit: 'fixed', rate: 500000 }],
    });
    const { pages } = await render(invoice, 'minimal');
    const text = pages[0] as string;
    expect(squash(text)).toContain('invoice');
    expect(squash(text)).not.toContain('taxinvoice');
    expect(text).not.toContain('CGST');
    expect(text).toContain('Not registered under GST.');
    expect(text).toContain('Fixed fee');
    expect(text).toContain('₹5,000.00');
  });

  it('shows an export in dollars with the LUT statement', async () => {
    const invoice = makeInvoice({
      seller: makeSeller({ lutNumber: 'AD270326012345Z' }),
      client: makeClient({ gstin: undefined, address: { line1: '1 Main St', city: 'Austin', country: 'United States' } }),
      currency: 'USD',
      isExport: true,
      placeOfSupplyStateCode: undefined,
      lines: [{ id: 'a', description: 'Consulting', quantity: 1, unit: 'fixed', rate: 123456, gstRate: 18 }],
    });
    const { pages } = await render(invoice, 'bold');
    const text = pages[0] as string;
    expect(text).toContain('$1,234.56');
    expect(text).toContain('LUT No. AD270326012345Z');
    expect(text).toContain('Outside India (export)');
    expect(text).toContain('United States');
  });

  it('stamps DRAFT and CANCELLED on invoices that are not issued', async () => {
    const draft = await render(makeInvoice({ status: 'draft' }), 'classic');
    expect(draft.pages[0]).toContain('DRAFT');
    const cancelled = await render(makeInvoice({ status: 'cancelled' }), 'classic');
    expect(cancelled.pages[0]).toContain('CANCELLED');
    const issued = await render(makeInvoice(), 'classic');
    expect(issued.pages[0]).not.toContain('DRAFT');
    expect(issued.pages[0]).not.toContain('CANCELLED');
  });

  it('titles a proforma invoice', async () => {
    const { pages } = await render(makeInvoice({ kind: 'proforma' }), 'formal');
    expect(squash(pages[0] as string)).toContain('proformainvoice');
  });

  it('shows notes, terms and the due date', async () => {
    const { pages } = await render(makeInvoice({ notes: 'Thank you for your business.', terms: 'Payment within 15 days.', dueDate: '2026-10-29' }), 'consultant');
    const text = pages[0] as string;
    expect(text).toContain('Thank you for your business.');
    expect(text).toContain('Payment within 15 days.');
    expect(text).toContain('29 Oct 2026');
  });

  it('draws a logo from a PNG data URL without failing', async () => {
    const logo = await buildQrDataUrl('logo-stand-in', 64);
    const { pages } = await render(makeInvoice({ seller: makeSeller({ logoDataUrl: logo }) }), 'classic');
    expect(pages[0]).toContain('Asha Rao Consulting');
  });

  it('keeps accented and non-ASCII Latin text from clients and descriptions', async () => {
    const invoice = makeInvoice({
      client: makeClient({ name: 'Łódź Café & Co.' }),
      lines: [{ id: 'a', description: 'Façade design: naïve résumé', quantity: 1, unit: 'fixed', rate: 100000, gstRate: 18 }],
    });
    const { pages } = await render(invoice, 'classic');
    expect(pages[0]).toContain('Łódź Café & Co.');
    expect(pages[0]).toContain('Façade design: naïve résumé');
  });
});

describe('InvoicePdf: long invoices', () => {
  it('flows onto more pages and numbers them', async () => {
    const lines = Array.from({ length: 60 }, (_, index) => ({
      id: `l${index}`,
      description: `Line item ${index + 1}`,
      quantity: 1,
      unit: 'items' as const,
      rate: 100000,
      gstRate: 18,
    }));
    const { pages } = await render(makeInvoice({ lines }), 'classic');
    expect(pages.length).toBeGreaterThan(1);
    const all = pages.join(' ');
    expect(all).toContain('Line item 1 ');
    expect(all).toContain('Line item 60');
    expect(all).toContain('Page 1 of');
    expect(pages[pages.length - 1]).toContain('Authorised signatory');
  });

  it('wraps a very long description instead of cutting it off', async () => {
    const description = `${'Detailed consulting engagement covering discovery workshops and delivery '.repeat(5)}END-MARKER`;
    const { pages } = await render(makeInvoice({ lines: [{ id: 'a', description, quantity: 1, unit: 'fixed', rate: 100000, gstRate: 18 }] }), 'classic');
    expect(pages.join(' ')).toContain('END-MARKER');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tool-invoice-pdf test -- invoice-pdf`
Expected: FAIL (cannot resolve `./InvoicePdf`).

- [ ] **Step 3: Implement the sections**

`packages/tools/invoice-pdf/src/sections.tsx`:
```tsx
import { Image, Text, View } from '@react-pdf/renderer';
import type { InvoiceDocument, InvoiceTheme } from '@solokit/tool-invoice';
import { mixHex, readableOn } from './colors';
import type { LayoutSpec } from './layouts';

export interface Palette {
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  tint: string;
  line: string;
  bg: string;
}

export function paletteFor(theme: InvoiceTheme): Palette {
  return {
    text: theme.text,
    bg: theme.background,
    accent: theme.accent,
    onAccent: readableOn(theme.accent),
    muted: mixHex(theme.text, theme.background, 0.62),
    tint: mixHex(theme.accent, theme.background, 0.1),
    line: mixHex(theme.text, theme.background, 0.2),
  };
}

export interface SectionProps {
  doc: InvoiceDocument;
  spec: LayoutSpec;
  palette: Palette;
}

const SMALL = 8;
const LABEL = 7;
const PAGE_MARGIN = 36;

function Label({ children, palette }: { children: string; palette: Palette }) {
  return <Text style={{ fontSize: LABEL, color: palette.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>{children}</Text>;
}

function PartyLines({ party, palette }: { party: InvoiceDocument['seller']; palette: Palette }) {
  return (
    <>
      {party.lines.map((line, index) => (
        <Text key={index} style={{ fontSize: SMALL, color: palette.muted }}>
          {line}
        </Text>
      ))}
      {party.gstin ? <Text style={{ fontSize: SMALL }}>GSTIN: {party.gstin}</Text> : null}
      {party.pan ? <Text style={{ fontSize: SMALL }}>PAN: {party.pan}</Text> : null}
      {party.email ? <Text style={{ fontSize: SMALL }}>{party.email}</Text> : null}
      {party.phone ? <Text style={{ fontSize: SMALL }}>{party.phone}</Text> : null}
    </>
  );
}

function SellerBlock({ doc, palette }: Pick<SectionProps, 'doc' | 'palette'>) {
  return (
    <View style={{ flexGrow: 1, maxWidth: '58%' }}>
      {doc.logoDataUrl ? (
        <Image src={doc.logoDataUrl} style={{ width: 120, height: 44, objectFit: 'contain', objectPosition: 'left center', marginBottom: 6 }} />
      ) : null}
      <Text style={{ fontSize: 13, fontWeight: 700 }}>{doc.seller.name}</Text>
      <PartyLines party={doc.seller} palette={palette} />
    </View>
  );
}

function MetaRows({ doc, color, labelColor, align }: { doc: InvoiceDocument; color: string; labelColor: string; align: 'flex-start' | 'flex-end' }) {
  const rows: [string, string][] = [
    ['No.', doc.number],
    ['Date', doc.issueDate],
  ];
  if (doc.dueDate) rows.push(['Due', doc.dueDate]);
  return (
    <View style={{ alignItems: align }}>
      {rows.map(([label, value]) => (
        <Text key={label} style={{ fontSize: 9, color }}>
          <Text style={{ color: labelColor }}>{label}  </Text>
          {value}
        </Text>
      ))}
    </View>
  );
}

function Rule({ spec, palette }: Pick<SectionProps, 'spec' | 'palette'>) {
  if (spec.rules === 'none') return null;
  const line = { borderBottomWidth: 0.9, borderBottomColor: palette.accent, borderBottomStyle: 'solid' as const };
  if (spec.rules === 'double') {
    return (
      <View style={{ marginVertical: 10 }}>
        <View style={line} />
        <View style={{ ...line, marginTop: 2 }} />
      </View>
    );
  }
  return <View style={{ ...line, marginVertical: 10 }} />;
}

export function Header({ doc, spec, palette }: SectionProps) {
  const title = spec.uppercaseTitle ? doc.title.toUpperCase() : doc.title;
  const titleStyle = { fontSize: spec.titleSize, fontWeight: 700 as const, letterSpacing: spec.uppercaseTitle ? 1.5 : 0 };

  if (spec.header === 'band') {
    return (
      <View>
        <View
          style={{
            backgroundColor: palette.accent,
            marginTop: -PAGE_MARGIN,
            marginLeft: -PAGE_MARGIN,
            marginRight: -PAGE_MARGIN,
            marginBottom: 16,
            paddingVertical: 20,
            paddingHorizontal: PAGE_MARGIN,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <Text style={{ ...titleStyle, color: palette.onAccent }}>{title}</Text>
          <MetaRows doc={doc} color={palette.onAccent} labelColor={palette.onAccent} align="flex-end" />
        </View>
        <View style={{ marginBottom: 14 }}>
          <SellerBlock doc={doc} palette={palette} />
        </View>
      </View>
    );
  }

  if (spec.header === 'centered') {
    return (
      <View>
        <Text style={{ ...titleStyle, color: palette.accent, textAlign: 'center' }}>{title}</Text>
        <Rule spec={spec} palette={palette} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <SellerBlock doc={doc} palette={palette} />
          <MetaRows doc={doc} color={palette.text} labelColor={palette.muted} align="flex-end" />
        </View>
      </View>
    );
  }

  // plain and sidebar share the same arrangement; the sidebar strip is drawn by InvoicePdf.
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <SellerBlock doc={doc} palette={palette} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ ...titleStyle, color: palette.accent, marginBottom: 6 }}>{title}</Text>
          <MetaRows doc={doc} color={palette.text} labelColor={palette.muted} align="flex-end" />
        </View>
      </View>
      <Rule spec={spec} palette={palette} />
      <View style={{ marginBottom: spec.rules === 'none' ? 14 : 4 }} />
    </View>
  );
}

export function PartiesBlock({ doc, spec, palette }: SectionProps) {
  const details: [string, string][] = [];
  if (doc.placeOfSupply) details.push(['Place of supply', doc.placeOfSupply]);
  if (doc.currency !== 'INR') details.push(['Currency', doc.currency]);
  const box = spec.partiesBox ? { borderWidth: 0.75, borderColor: palette.line, borderStyle: 'solid' as const, padding: 8 } : {};
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
      <View style={{ width: '56%', ...box }}>
        <Label palette={palette}>Bill to</Label>
        <Text style={{ fontSize: 11, fontWeight: 700 }}>{doc.client.name}</Text>
        <PartyLines party={doc.client} palette={palette} />
      </View>
      {details.length > 0 ? (
        <View style={{ width: '38%' }}>
          <Label palette={palette}>Supply details</Label>
          {details.map(([label, value]) => (
            <Text key={label} style={{ fontSize: SMALL }}>
              <Text style={{ color: palette.muted }}>{label}  </Text>
              {value}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface Column {
  key: 'no' | 'description' | 'quantity' | 'rate' | 'discount' | 'taxRate' | 'taxAmount' | 'amount';
  label: string;
  width: number;
  align: 'left' | 'right';
}

function columnsFor(doc: InvoiceDocument): Column[] {
  const fixed: Column[] = [
    { key: 'no', label: '#', width: 5, align: 'left' },
    { key: 'quantity', label: 'Qty', width: 12, align: 'right' },
    { key: 'rate', label: 'Rate', width: 14, align: 'right' },
  ];
  if (doc.showDiscount) fixed.push({ key: 'discount', label: 'Discount', width: 12, align: 'right' });
  if (doc.showTax) {
    fixed.push({ key: 'taxRate', label: 'GST', width: 7, align: 'right' });
    fixed.push({ key: 'taxAmount', label: 'Tax', width: 13, align: 'right' });
  }
  fixed.push({ key: 'amount', label: 'Amount', width: 15, align: 'right' });
  const used = fixed.reduce((total, column) => total + column.width, 0);
  const description: Column = { key: 'description', label: 'Description', width: 100 - used, align: 'left' };
  return [fixed[0] as Column, description, ...fixed.slice(1)];
}

export function LinesTable({ doc, spec, palette }: SectionProps) {
  const columns = columnsFor(doc);
  const header =
    spec.tableHeader === 'fill'
      ? { backgroundColor: palette.accent, color: palette.onAccent }
      : spec.tableHeader === 'tint'
        ? { backgroundColor: mixHex(palette.accent, palette.bg, 0.14), color: palette.accent }
        : { color: palette.accent, borderBottomWidth: 1.2, borderBottomColor: palette.accent, borderBottomStyle: 'solid' as const };
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 5, ...header }}>
        {columns.map((column) => (
          <Text key={column.key} style={{ width: `${column.width}%`, fontSize: SMALL, fontWeight: 700, textAlign: column.align }}>
            {column.label}
          </Text>
        ))}
      </View>
      {doc.lines.map((line, index) => (
        <View
          key={line.number}
          wrap={false}
          style={{
            flexDirection: 'row',
            paddingVertical: 5,
            paddingHorizontal: 5,
            borderBottomWidth: 0.5,
            borderBottomColor: palette.line,
            borderBottomStyle: 'solid',
            ...(spec.zebra && index % 2 === 1 ? { backgroundColor: palette.tint } : {}),
          }}
        >
          {columns.map((column) =>
            column.key === 'description' ? (
              <View key={column.key} style={{ width: `${column.width}%`, paddingRight: 6 }}>
                <Text style={{ fontSize: 9 }}>{line.description}</Text>
                {doc.showCode && line.code ? <Text style={{ fontSize: LABEL, color: palette.muted }}>HSN/SAC {line.code}</Text> : null}
              </View>
            ) : (
              <Text key={column.key} style={{ width: `${column.width}%`, fontSize: 9, textAlign: column.align }}>
                {column.key === 'no' ? String(line.number) : line[column.key]}
              </Text>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

export function SummaryBlock({ doc, spec, palette }: SectionProps) {
  return (
    <View wrap={false} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
      <View style={{ width: '42%' }}>
        <Label palette={palette}>Amount in words</Label>
        <Text style={{ fontSize: 9 }}>{doc.amountInWords}</Text>
      </View>
      <View style={{ width: '50%' }}>
        {doc.totals.map((row) => {
          const isTotal = row.emphasis === 'total';
          const isNet = row.emphasis === 'net';
          const boxed = isTotal && spec.totalsBox;
          return (
            <View
              key={`${row.label}-${row.amount}`}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: isTotal || isNet ? 5 : 3,
                paddingHorizontal: boxed ? 6 : 0,
                ...(boxed ? { backgroundColor: mixHex(palette.accent, palette.bg, 0.12) } : {}),
                ...(isTotal && !boxed ? { borderTopWidth: 1, borderTopColor: palette.accent, borderTopStyle: 'solid' as const } : {}),
              }}
            >
              <Text style={{ fontSize: isTotal ? 11 : 9, fontWeight: isTotal || isNet ? 700 : 400, color: row.emphasis === 'muted' ? palette.muted : isNet ? palette.accent : palette.text }}>
                {row.label}
              </Text>
              <Text style={{ fontSize: isTotal ? 11 : 9, fontWeight: isTotal || isNet ? 700 : 400, color: row.emphasis === 'muted' ? palette.muted : isNet ? palette.accent : palette.text }}>
                {row.amount}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function PaymentBlock({ doc, palette, qrDataUrl }: Pick<SectionProps, 'doc' | 'palette'> & { qrDataUrl?: string | undefined }) {
  const { bank, upi } = doc.payment;
  if (!bank && !upi) return null;
  return (
    <View wrap={false} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
      {bank ? (
        <View style={{ width: '56%' }}>
          <Label palette={palette}>Bank details</Label>
          {bank.map((row) => (
            <Text key={row.label} style={{ fontSize: SMALL }}>
              <Text style={{ color: palette.muted }}>{row.label}  </Text>
              {row.value}
            </Text>
          ))}
        </View>
      ) : null}
      {upi ? (
        <View style={{ alignItems: 'center', width: 96 }}>
          {qrDataUrl ? <Image src={qrDataUrl} style={{ width: 72, height: 72 }} /> : null}
          <Text style={{ fontSize: LABEL, color: palette.muted, marginTop: 3, textAlign: 'center' }}>Scan to pay (UPI)</Text>
          <Text style={{ fontSize: LABEL, textAlign: 'center' }}>{upi.id}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function NotesBlock({ doc, palette }: Pick<SectionProps, 'doc' | 'palette'>) {
  if (doc.declarations.length === 0 && !doc.notes && !doc.terms) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      {doc.declarations.map((line) => (
        <Text key={line} style={{ fontSize: SMALL, marginBottom: 2 }}>
          {line}
        </Text>
      ))}
      {doc.notes ? (
        <View style={{ marginTop: 6 }}>
          <Label palette={palette}>Notes</Label>
          <Text style={{ fontSize: SMALL }}>{doc.notes}</Text>
        </View>
      ) : null}
      {doc.terms ? (
        <View style={{ marginTop: 6 }}>
          <Label palette={palette}>Terms</Label>
          <Text style={{ fontSize: SMALL }}>{doc.terms}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function SignatoryBlock({ doc, palette }: Pick<SectionProps, 'doc' | 'palette'>) {
  return (
    <View wrap={false} style={{ alignItems: 'flex-end', marginTop: 10 }}>
      <Text style={{ fontSize: SMALL }}>For {doc.signatory.forName}</Text>
      <View style={{ height: 36 }} />
      <View style={{ width: 150, borderTopWidth: 0.75, borderTopColor: palette.text, borderTopStyle: 'solid' }} />
      <Text style={{ fontSize: LABEL, color: palette.muted, marginTop: 2 }}>{doc.signatory.label}</Text>
    </View>
  );
}

export function PageFooter({ doc, palette }: Pick<SectionProps, 'doc' | 'palette'>) {
  return (
    <View fixed style={{ position: 'absolute', bottom: 18, left: PAGE_MARGIN, right: PAGE_MARGIN, flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: LABEL, color: palette.muted }}>
        {doc.title} {doc.number}
      </Text>
      <Text style={{ fontSize: LABEL, color: palette.muted }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

export function Watermark({ doc, palette }: Pick<SectionProps, 'doc' | 'palette'>) {
  if (doc.status === 'issued') return null;
  return (
    <Text
      fixed
      style={{
        position: 'absolute',
        top: 330,
        left: 70,
        fontSize: 90,
        fontWeight: 700,
        color: mixHex('#9CA3AF', palette.bg, 0.3),
        transform: 'rotate(-30deg)',
      }}
    >
      {doc.status.toUpperCase()}
    </Text>
  );
}
```

- [ ] **Step 4: Implement the component**

`packages/tools/invoice-pdf/src/InvoicePdf.tsx`:
```tsx
import { Document, Page, View } from '@react-pdf/renderer';
import type { InvoiceDocument, InvoiceTheme } from '@solokit/tool-invoice';
import { LAYOUTS } from './layouts';
import {
  Header,
  LinesTable,
  NotesBlock,
  PageFooter,
  PartiesBlock,
  PaymentBlock,
  SignatoryBlock,
  SummaryBlock,
  Watermark,
  paletteFor,
} from './sections';

export interface InvoicePdfProps {
  doc: InvoiceDocument;
  theme: InvoiceTheme;
  /** PNG data URL of the UPI QR code. */
  qrDataUrl?: string;
}

export function InvoicePdf({ doc, theme, qrDataUrl }: InvoicePdfProps) {
  const spec = LAYOUTS[theme.layout];
  const palette = paletteFor(theme);
  const common = { doc, spec, palette };
  return (
    <Document title={`${doc.title} ${doc.number}`} author={doc.seller.name} subject={`${doc.title} for ${doc.client.name}`} creator="SoloKit">
      <Page
        size="A4"
        style={{
          fontFamily: theme.fontId,
          fontSize: 9,
          color: palette.text,
          backgroundColor: palette.bg,
          padding: 36,
          paddingBottom: 54,
        }}
      >
        <Watermark doc={doc} palette={palette} />
        {spec.header === 'sidebar' ? (
          <View fixed style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 10, backgroundColor: palette.accent }} />
        ) : null}
        <Header {...common} />
        <PartiesBlock {...common} />
        <LinesTable {...common} />
        <SummaryBlock {...common} />
        <PaymentBlock doc={doc} palette={palette} qrDataUrl={qrDataUrl} />
        <NotesBlock doc={doc} palette={palette} />
        <SignatoryBlock doc={doc} palette={palette} />
        <PageFooter doc={doc} palette={palette} />
      </Page>
    </Document>
  );
}
```

- [ ] **Step 5: Export, run tests and typecheck**

Append to `packages/tools/invoice-pdf/src/index.ts`:
```ts
export { InvoicePdf, type InvoicePdfProps } from './InvoicePdf';
```
Run: `pnpm --filter @solokit/tool-invoice-pdf test`
Expected: PASS (all files).
If a text expectation fails because pdf.js splits or reorders a string, first check what the extracted page text really contains (print it) and decide whether the PDF or the test is wrong; do not loosen a test to hide a missing or garbled piece of text. If react-pdf rejects a style value (for example `textTransform` or `transform`), report the exact error.
Run: `pnpm --filter @solokit/tool-invoice-pdf typecheck`
Expected: no errors. (`@solokit/tool-invoice/testing` must resolve; it is exported in Task 1.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(invoice-pdf): render invoices in six theme layouts

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The render entry point, sample PDFs and verification

**Files:**
- Create: `packages/tools/invoice-pdf/src/render.tsx`, `src/samples.test.tsx`
- Modify: `src/index.ts`, `README.md`
- Test: `src/render.test.tsx`

**Interfaces:**
- Consumes: `buildInvoiceDocument`, `resolveTheme`, `type InvoiceRecord`, `type InvoiceTheme` from `@solokit/tool-invoice`.
- Produces: `renderInvoicePdf(input: { invoice: InvoiceRecord; theme: InvoiceTheme; fontBase: string }): Promise<Blob>` and `pdfFilename(invoice: InvoiceRecord): string` (for example `Invoice-2026-27-0001.pdf`: the invoice number with `/` replaced by `-`, prefixed with "Invoice", "Bill-of-Supply" or "Proforma" according to the document title, `.pdf`).

- [ ] **Step 1: Write the failing tests**

`packages/tools/invoice-pdf/src/render.test.tsx`:
```tsx
import { PRESET_THEMES } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { describe, expect, it } from 'vitest';
import { pdfFilename, renderInvoicePdf } from './render';
import { FONT_DIR, extractPdfText } from './testing';

const theme = (id: string) => {
  const found = PRESET_THEMES.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Unknown theme ${id}`);
  return found;
};

describe('renderInvoicePdf', () => {
  it('returns a PDF blob for an invoice and a theme', async () => {
    const blob = await renderInvoicePdf({ invoice: makeInvoice(), theme: theme('modern'), fontBase: FONT_DIR });
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(2000);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe('%PDF-');
    const [page] = await extractPdfText(bytes);
    expect(page).toContain('₹84,960.00');
    expect(page).toContain('asha@okhdfc');
  });

  it('draws the UPI QR code for INR invoices that have a UPI id and an amount to pay', async () => {
    const withUpi = await renderInvoicePdf({ invoice: makeInvoice(), theme: theme('classic'), fontBase: FONT_DIR });
    const withoutUpi = await renderInvoicePdf({
      invoice: makeInvoice({ seller: makeSeller({ upiId: undefined }) }),
      theme: theme('classic'),
      fontBase: FONT_DIR,
    });
    expect(withUpi.size).toBeGreaterThan(withoutUpi.size);
  });

  it('renders every preset', async () => {
    for (const preset of PRESET_THEMES) {
      const blob = await renderInvoicePdf({ invoice: makeInvoice(), theme: preset, fontBase: FONT_DIR });
      expect(blob.size, preset.id).toBeGreaterThan(2000);
    }
  });

  it('keeps a small invoice well under 150 KB', async () => {
    const blob = await renderInvoicePdf({ invoice: makeInvoice(), theme: theme('classic'), fontBase: FONT_DIR });
    expect(blob.size).toBeLessThan(150 * 1024);
  });

  it('works with every bundled font', async () => {
    for (const fontId of ['inter', 'poppins', 'source-serif-4', 'ibm-plex-mono', 'geist-mono'] as const) {
      const blob = await renderInvoicePdf({
        invoice: makeInvoice(),
        theme: { ...theme('classic'), fontId },
        fontBase: FONT_DIR,
      });
      const [page] = await extractPdfText(new Uint8Array(await blob.arrayBuffer()));
      expect(page, fontId).toContain('₹84,960.00');
    }
  });
});

describe('pdfFilename', () => {
  it('turns the invoice number into a safe file name', () => {
    expect(pdfFilename(makeInvoice())).toBe('Invoice-2026-27-0001.pdf');
    expect(pdfFilename(makeInvoice({ number: 'INV/2026-27/0012' }))).toBe('Invoice-INV-2026-27-0012.pdf');
  });

  it('names bills of supply and proforma invoices accordingly', () => {
    expect(pdfFilename(makeInvoice({ seller: makeSeller({ gstStatus: 'composition' }) }))).toBe('Bill-of-Supply-2026-27-0001.pdf');
    expect(pdfFilename(makeInvoice({ kind: 'proforma' }))).toBe('Proforma-Invoice-2026-27-0001.pdf');
  });

  it('names an unregistered seller\'s plain invoice "Invoice"', () => {
    expect(pdfFilename(makeInvoice({ seller: makeSeller({ gstStatus: 'unregistered', gstin: undefined }), placeOfSupplyStateCode: undefined }))).toBe(
      'Invoice-2026-27-0001.pdf',
    );
  });
});
```

`packages/tools/invoice-pdf/src/samples.test.tsx`:
```tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRESET_THEMES } from '@solokit/tool-invoice';
import { makeClient, makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { describe, it } from 'vitest';
import { renderInvoicePdf } from './render';
import { FONT_DIR } from './testing';

// Writes sample PDFs for a human to look at. Skipped unless SAMPLES_DIR is set, for example:
//   SAMPLES_DIR=/tmp/solokit-samples pnpm --filter @solokit/tool-invoice-pdf test -- samples
const directory = process.env.SAMPLES_DIR;

describe.skipIf(!directory)('sample PDFs', () => {
  it('writes one sample per layout and a few special cases', async () => {
    const out = directory as string;
    mkdirSync(out, { recursive: true });
    const lines = Array.from({ length: 40 }, (_, index) => ({
      id: `l${index}`,
      description: `Consulting session ${index + 1}`,
      code: '998312',
      quantity: 1.5,
      unit: 'hours' as const,
      rate: 250000,
      gstRate: 18,
      ...(index === 2 ? { discount: { kind: 'percent' as const, percent: 10 } } : {}),
    }));
    const cases: [string, Parameters<typeof makeInvoice>[0], string][] = [
      ...PRESET_THEMES.map((theme): [string, Parameters<typeof makeInvoice>[0], string] => [`layout-${theme.id}`, { tds: { ratePercent: 10 }, notes: 'Thank you for your business.', terms: 'Payment within 15 days.', dueDate: '2026-10-29' }, theme.id]),
      ['unregistered', { seller: makeSeller({ gstStatus: 'unregistered', gstin: undefined }), placeOfSupplyStateCode: undefined, lines: [{ id: 'a', description: 'Logo design', quantity: 1, unit: 'fixed', rate: 500000 }] }, 'minimal'],
      ['export-usd', { seller: makeSeller({ lutNumber: 'AD270326012345Z' }), client: makeClient({ gstin: undefined, address: { line1: '1 Main St', city: 'Austin', country: 'United States' } }), currency: 'USD', isExport: true, placeOfSupplyStateCode: undefined, lines: [{ id: 'a', description: 'Consulting', quantity: 1, unit: 'fixed', rate: 123456, gstRate: 18 }] }, 'bold'],
      ['draft', { status: 'draft' }, 'classic'],
      ['long-40-lines', { lines }, 'consultant'],
    ];
    for (const [name, overrides, themeId] of cases) {
      const theme = PRESET_THEMES.find((candidate) => candidate.id === themeId);
      if (!theme) throw new Error(`Unknown theme ${themeId}`);
      const blob = await renderInvoicePdf({ invoice: makeInvoice(overrides), theme, fontBase: FONT_DIR });
      writeFileSync(join(out, `${name}.pdf`), Buffer.from(await blob.arrayBuffer()));
    }
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @solokit/tool-invoice-pdf test -- render`
Expected: FAIL (cannot resolve `./render`).

- [ ] **Step 3: Implement**

`packages/tools/invoice-pdf/src/render.tsx`:
```tsx
import { pdf } from '@react-pdf/renderer';
import { buildInvoiceDocument, type InvoiceRecord, type InvoiceTheme } from '@solokit/tool-invoice';
import { registerInvoiceFonts } from './fonts';
import { InvoicePdf } from './InvoicePdf';
import { buildQrDataUrl } from './qr';

export interface RenderInvoiceInput {
  invoice: InvoiceRecord;
  theme: InvoiceTheme;
  /** Where the invoice fonts are served from: "/fonts/invoice" in the browser. */
  fontBase: string;
}

/** Builds the PDF for an invoice. Throws if the invoice is not valid enough to build (validate first). */
export async function renderInvoicePdf({ invoice, theme, fontBase }: RenderInvoiceInput): Promise<Blob> {
  registerInvoiceFonts(fontBase);
  const doc = buildInvoiceDocument(invoice);
  const qrDataUrl = doc.payment.upi ? await buildQrDataUrl(doc.payment.upi.payload) : undefined;
  return pdf(<InvoicePdf doc={doc} theme={theme} {...(qrDataUrl ? { qrDataUrl } : {})} />).toBlob();
}

/** "Invoice-2026-27-0001.pdf": the document title and the number, safe for file systems. */
export function pdfFilename(invoice: InvoiceRecord): string {
  const { title, number } = buildInvoiceDocument(invoice);
  const safeTitle = title.replace(/\s+/g, '-');
  const safeNumber = number.replace(/[^A-Za-z0-9-]+/g, '-');
  return `${safeTitle}-${safeNumber}.pdf`;
}
```

- [ ] **Step 4: Export, run the whole suite, typecheck**

Append to `packages/tools/invoice-pdf/src/index.ts`:
```ts
export { pdfFilename, renderInvoicePdf, type RenderInvoiceInput } from './render';
```
Run: `pnpm --filter @solokit/tool-invoice-pdf test`
Expected: PASS (samples are skipped).
Run: `pnpm --filter @solokit/tool-invoice-pdf typecheck`
Expected: no errors.

- [ ] **Step 5: Write sample PDFs for a visual check**

Run (use a folder outside the repository, for example the system temp directory):
`SAMPLES_DIR="$(mktemp -d)/solokit-samples" pnpm --filter @solokit/tool-invoice-pdf test -- samples`
Expected: the samples test PASSES (not skipped) and writes 10 PDFs: `layout-classic.pdf` ... `layout-formal.pdf`, `unregistered.pdf`, `export-usd.pdf`, `draft.pdf`, `long-40-lines.pdf`. Print the folder path in your report. Do not commit the PDFs.

- [ ] **Step 6: README and root verification**

In `README.md` add to the Layout list after the `packages/tools/invoice` line:
```
- `packages/tools/invoice-pdf` renders invoices to PDF in the browser (six layouts, bundled fonts, UPI QR); fonts are built with `pnpm --filter @solokit/web fonts`
```
and change the Status "Next" line to `- Next: the invoice screens.`
Run from the repo root: `pnpm install` (exit 0), `pnpm test` (every package passes), `pnpm typecheck` (no errors), `pnpm build` ("Compiled successfully"; the new fonts under `apps/web/public/fonts/invoice` must appear in `apps/web/out/fonts/invoice` and in the service worker's precache list: check with `grep -c "fonts/invoice" apps/web/out/sw.js`, expected at least 11).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(invoice-pdf): add the render entry point, file names and sample generator

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage (this plan's scope):**
- Bundled Google fonts, latin + latin-ext, one family per group, no uploads, self-hosted: Task 1 (generated files, licences, glyph test), Task 2 (registration).
- Rupee sign and other currency symbols in the PDF: proven in Task 1 (glyph coverage in every file) and Task 2 (real PDFs for every family).
- Six preset layouts with colour and font variation: Tasks 4 and 5.
- One renderer for preview and download: `renderInvoicePdf` (Task 6); Plan 3C shows the same blob in the preview.
- UPI QR on the invoice: Task 3 and Task 5/6.
- Logo: drawn in the header (Task 5); upload and PNG conversion belong to Plan 3C.
- Declarations, TDS and net payable, export LUT, DRAFT and CANCELLED stamps, signature block, page numbers: Task 5.
- Font licensing (OFL notices, Reserved Font Name handling for IBM Plex Mono): Task 1.
- Offline: fonts are plain files under `public/`, so the existing build step precaches them (verified in Task 6).
- Out of this plan (Plan 3C): all screens, logo upload and conversion, theme editor, saved invoices, backup UI, registry flip, StoreProvider hardening, site mono font swap.

**Placeholder scan:** none; every code step has complete code. ()

**Type consistency:** `InvoiceDocument` (with `status`, `kind`, `signatory`), `InvoiceTheme`, `FONT_OPTIONS`/`FontId`, `PRESET_THEMES` and `buildInvoiceDocument` come from `@solokit/tool-invoice`; `LayoutSpec`/`LAYOUTS`, `Palette`/`paletteFor`, `InvoicePdfProps`, `renderInvoicePdf` and `registerInvoiceFonts` keep identical names across tasks. Font ids match `FONT_OPTIONS` in the file names (`<id>-<weight>.ttf`).
