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
