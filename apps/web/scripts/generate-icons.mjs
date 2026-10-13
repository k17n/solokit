// Renders the app icons to PNG. Run with: pnpm --filter @solokit/web icons
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// `inset` shrinks the artwork so maskable icons keep it inside the safe zone.
function svg({ rounded, inset }) {
  const scale = 1 - inset * 2;
  const offset = 64 * inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" ${rounded ? 'rx="14"' : ''} fill="#0B1B3A"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="M17 11h30v41.6l-5-3.4-5 3.4-5-3.4-5 3.4-5-3.4-5 3.4z" fill="#FAF8F4"/>
    <path d="M24 24h16M24 32h10" stroke="#0B1B3A" stroke-width="3.2" stroke-linecap="round" fill="none"/>
    <circle cx="44" cy="14" r="5" fill="#10B981"/>
  </g>
</svg>`;
}

const icons = [
  { file: 'icon-192.png', size: 192, rounded: true, inset: 0 },
  { file: 'icon-512.png', size: 512, rounded: true, inset: 0 },
  { file: 'icon-maskable-512.png', size: 512, rounded: false, inset: 0.1 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, inset: 0.06 },
];

for (const { file, size, rounded, inset } of icons) {
  const png = new Resvg(svg({ rounded, inset }), { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(join(outDir, file), png);
  console.log(`wrote ${file} (${size}x${size})`);
}
