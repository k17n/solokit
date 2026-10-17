// Post-build step: injects the build id and the full list of exported files
// into out/sw.js so the service worker precaches the whole site.
// Run from apps/web after `next build`: node scripts/sw-precache.mjs
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Error pages are skipped: some static hosts serve them with a 404 status,
// which would make cache.addAll() reject and block the worker from installing.
const isErrorPage = (path) => /^(404\.html|404\/index\.html|_not-found(\.|\/))/.test(path);

// Cloudflare Pages reads _headers and _redirects but never serves them, and robots.txt and sitemap.xml are for crawlers.
const isHostFile = (path) => ['_headers', '_redirects', 'robots.txt', 'sitemap.xml'].includes(path);

const isPrecached = (path) => path !== 'sw.js' && !path.endsWith('.map') && !isErrorPage(path) && !isHostFile(path);

function toUrl(path) {
  if (path === 'index.html') return '/';
  if (path.endsWith('/index.html')) return `/${path.slice(0, -'index.html'.length)}`;
  return `/${path}`;
}

/** Maps files found in out/ (relative paths) to site URLs: sorted, unique. */
export function collectUrls(relativeFiles) {
  const urls = new Set();
  for (const file of relativeFiles) {
    const path = file.replace(/\\/g, '/');
    if (isPrecached(path)) urls.add(toUrl(path));
  }
  return [...urls].sort();
}

/** Deterministic 12-hex-char id over the sorted `url:hash` lines. */
export function buildId(entries) {
  const lines = entries.map((e) => `${e.url}:${e.hash}`).sort();
  return createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 12);
}

/** Replaces the template tokens in the service worker source. */
export function injectPrecache(source, id, urls) {
  for (const token of ['__BUILD_ID__', '__PRECACHE_URLS__']) {
    if (!source.includes(token)) throw new Error(`sw.js is missing the ${token} token`);
  }
  // Function replacers: a string replacement would interpret $&, $$, $` and $'.
  const json = JSON.stringify(urls);
  return source.replaceAll('__BUILD_ID__', () => id).replaceAll('__PRECACHE_URLS__', () => json);
}

function walk(dir, base = '') {
  const files = [];
  for (const name of readdirSync(dir)) {
    const rel = base ? `${base}/${name}` : name;
    if (statSync(join(dir, name)).isDirectory()) files.push(...walk(join(dir, name), rel));
    else files.push(rel);
  }
  return files;
}

function main() {
  const out = join(process.cwd(), 'out');
  if (!existsSync(out)) throw new Error(`out/ not found at ${out}; run next build first`);
  const swPath = join(out, 'sw.js');
  if (!existsSync(swPath)) throw new Error(`sw.js not found in ${out}`);

  const files = walk(out).filter(isPrecached);
  const urls = collectUrls(files);
  const entries = files.map((file) => ({
    url: toUrl(file),
    hash: createHash('sha256').update(readFileSync(join(out, file))).digest('hex'),
  }));
  const id = buildId(entries);
  writeFileSync(swPath, injectPrecache(readFileSync(swPath, 'utf8'), id, urls));

  const bytes = files.reduce((sum, file) => sum + statSync(join(out, file)).size, 0);
  console.log(`sw-precache: build ${id}, ${urls.length} URLs, ${bytes} bytes`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) main();
