// Serves apps/web/out the way Cloudflare Pages will: static files with the rules from out/_headers applied, so the
// e2e tests run against the real security headers and Content-Security-Policy.
// Usage (from apps/web): node scripts/serve-with-headers.mjs [port]
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Parses the _headers format: unindented lines are path patterns, indented lines are `Name: value`. */
export function parseHeaders(text) {
  const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (/^\s/.test(raw)) {
      const line = raw.trim();
      const colon = line.indexOf(':');
      if (colon > 0 && rules.length) {
        rules[rules.length - 1].headers.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()]);
      }
    } else {
      rules.push({ pattern: raw.trim(), headers: [] });
    }
  }
  return rules;
}

function matches(pattern, path) {
  const source = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}$`).test(path);
}

/** Headers for a path: every matching rule applies; the same name from several rules is joined with ", ". */
export function headersFor(rules, path) {
  const result = {};
  for (const rule of rules) {
    if (!matches(rule.pattern, path)) continue;
    for (const [name, value] of rule.headers) {
      const key = name.toLowerCase();
      result[key] = result[key] ? `${result[key]}, ${value}` : value;
    }
  }
  return result;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

function resolveFile(root, path) {
  const clean = normalize(decodeURIComponent(path)).split(sep).join('/');
  if (clean.includes('..')) return null;
  const direct = join(root, clean);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const index = join(root, clean, 'index.html');
  return existsSync(index) ? index : null;
}

function main() {
  const root = join(process.cwd(), 'out');
  const port = Number(process.argv[2] ?? 4180);
  const rules = parseHeaders(readFileSync(join(root, '_headers'), 'utf8'));
  createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
    let file = resolveFile(root, pathname);
    let status = 200;
    // Like Cloudflare Pages with trailing slashes: /privacy redirects to /privacy/.
    if (file && file.endsWith('index.html') && !pathname.endsWith('/')) {
      res.writeHead(308, { location: `${pathname}/` }).end();
      return;
    }
    if (!file) {
      file = join(root, '404.html');
      status = 404;
    }
    const headers = {
      ...headersFor(rules, pathname),
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    };
    res.writeHead(status, headers).end(readFileSync(file));
  }).listen(port, () => console.log(`serving out/ with _headers on http://localhost:${port}`));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) main();
