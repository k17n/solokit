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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" ${rounded ? 'rx="6"' : ''} fill="#D4F225"/>
  <g transform="translate(${offset * 0.375} ${offset * 0.375}) scale(${scale})">
    <path d="M7.5 5.5h9v12.6l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z" fill="#111111"/>
    <path d="M9.75 9.25h4.5M9.75 12h2.75" stroke="#D4F225" stroke-width="1.4" stroke-linecap="round" fill="none"/>
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
