// Builds the invoice fonts. Run with: pnpm --filter @solokit/web fonts
// Each family gets regular (400) and bold (700) TTF files that contain Latin, Latin-ext and currency symbols
// (including the rupee sign) in ONE file, because react-pdf takes a single file per weight.
// A family whose copyright string or LICENSE_FONT header mentions a "Reserved Font Name" is copied UNMODIFIED
// (the OFL forbids a modified version, and subsetting counts, from using a reserved name); the rest are subset.
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import subsetFont from 'subset-font';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'fonts', 'invoice');
mkdirSync(outDir, { recursive: true });

const FAMILIES = [
  { id: 'inter', pkg: 'inter', file: 'Inter', label: 'Inter' },
  { id: 'poppins', pkg: 'poppins', file: 'Poppins', label: 'Poppins' },
  { id: 'source-serif-4', pkg: 'source-serif-4', file: 'SourceSerif4', label: 'Source Serif 4' },
  { id: 'inconsolata', pkg: 'inconsolata', file: 'Inconsolata', label: 'Inconsolata' },
  { id: 'geist-mono', pkg: 'geist-mono', file: 'GeistMono', label: 'Geist Mono' },
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

const RESERVED = /reserved font name/i;
const RESERVED_NAME = /Reserved Font Name\s+["“‘']?([^"”‘’',.]+)/i;

const results = [];
const sections = [];
for (const family of FAMILIES) {
  const packageDir = dirname(require.resolve(`@expo-google-fonts/${family.pkg}/package.json`));
  const licencePath = join(packageDir, 'LICENSE_FONT');
  if (!existsSync(licencePath)) throw new Error(`${family.label}: LICENSE_FONT is missing at ${licencePath}`);
  const licenceText = readFileSync(licencePath, 'utf8').trim();
  const sources = WEIGHTS.map(({ weight, folder }) => {
    const source = join(packageDir, folder, `${family.file}_${folder}.ttf`);
    return { weight, source, original: readFileSync(source) };
  });
  const copyright = (fontkit.create(sources[0].original).copyright ?? '').trim();
  if (!copyright) throw new Error(`${family.label}: the font's name table has an empty copyright string`);
  const header = licenceText.split(/\r?\n/).slice(0, 5).join('\n');
  const reserved = RESERVED.test(copyright) || RESERVED.test(header);
  const reservedFontName = reserved ? (RESERVED_NAME.exec(copyright) ?? RESERVED_NAME.exec(header))?.[1].trim() ?? null : null;
  for (const { weight, source, original } of sources) {
    const target = join(outDir, `${family.id}-${weight}.ttf`);
    if (reserved) {
      copyFileSync(source, target);
    } else {
      const subset = await subsetFont(original, characters, { targetFormat: 'truetype' });
      writeFileSync(target, Buffer.from(subset));
    }
    console.log(`wrote ${family.id}-${weight}.ttf${reserved ? ' (unmodified)' : ''}`);
  }
  results.push({ id: family.id, label: family.label, modified: !reserved, reservedFontName });
  sections.push(`==== ${family.label} ====`, copyright, '', licenceText, '', '');
}

const quoted = (r) => (r.reservedFontName ? ` (its licence reserves the name "${r.reservedFontName}")` : ' (its licence reserves a font name)');
const unmodified = results.filter((r) => !r.modified);
const modified = results.filter((r) => r.modified);
const licenceParts = ['Fonts used for invoice PDFs. All are licensed under the SIL Open Font License 1.1.'];
if (unmodified.length) licenceParts.push('Distributed unmodified (not subset, original names kept): ' + unmodified.map((r) => r.label + quoted(r)).join('; ') + '.');
if (modified.length) licenceParts.push('Modified (subset to Latin, Latin-ext and currency symbols; none of them reserves a font name): ' + modified.map((r) => r.label).join(', ') + '.');
licenceParts.push('', ...sections);
writeFileSync(join(outDir, 'THIRD_PARTY_LICENSES.txt'), licenceParts.join('\n'));
writeFileSync(join(outDir, 'fonts.json'), JSON.stringify({ families: results }, null, 2) + '\n');
console.log('wrote THIRD_PARTY_LICENSES.txt and fonts.json');
