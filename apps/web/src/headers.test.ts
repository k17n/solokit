import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { headersFor, parseHeaders } from '../scripts/serve-with-headers.mjs';

const rules = parseHeaders(readFileSync(join(__dirname, '..', 'public', '_headers'), 'utf8'));
const at = (path: string) => headersFor(rules, path);

describe('_headers parser', () => {
  it('reads patterns, headers and ignores comments', () => {
    expect(parseHeaders('# c\n/a/*\n  X-One: 1\n  X-Two: a: b\n\n/b\n  X-Three: 3\n')).toEqual([
      { pattern: '/a/*', headers: [['X-One', '1'], ['X-Two', 'a: b']] },
      { pattern: '/b', headers: [['X-Three', '3']] },
    ]);
  });

  it('merges every matching rule, joining repeated names like Cloudflare does', () => {
    const merged = parseHeaders('/*\n  X-A: 1\n/x/*\n  X-A: 2\n  X-B: 3\n');
    expect(headersFor(merged, '/x/y')).toEqual({ 'x-a': '1, 2', 'x-b': '3' });
    expect(headersFor(merged, '/z')).toEqual({ 'x-a': '1' });
  });
});

describe('the Cloudflare Pages _headers file', () => {
  it('sets the security headers on every page', () => {
    for (const path of ['/', '/privacy/', '/tools/invoice/', '/sw.js', '/_next/static/a.js']) {
      const h = at(path);
      expect(h['x-content-type-options']).toBe('nosniff');
      expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(h['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
      expect(h['x-frame-options']).toBe('DENY');
      expect(h['content-security-policy']).toBeTruthy();
    }
  });

  it('has a content security policy that allows the app, PDF previews and only the analytics beacon off site', () => {
    const csp = Object.fromEntries(
      at('/')['content-security-policy']!.split(';').map((part) => {
        const [name, ...values] = part.trim().split(/\s+/);
        return [name, values];
      }),
    );
    expect(csp['default-src']).toEqual(["'self'"]);
    expect(csp['script-src']).toEqual(["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", 'https://static.cloudflareinsights.com']);
    expect(csp['connect-src']).toEqual(["'self'", 'data:', 'https://cloudflareinsights.com']);
    expect(csp['img-src']).toEqual(expect.arrayContaining(["'self'", 'data:', 'blob:']));
    expect(csp['frame-src']).toContain('blob:');
    expect(csp['worker-src']).toContain("'self'");
    expect(csp['font-src']).toEqual(["'self'"]);
    expect(csp['frame-ancestors']).toEqual(["'none'"]);
    expect(JSON.stringify(csp)).not.toMatch(/(?<!wasm-)unsafe-eval|http:|\*/);
  });

  it('lets the service worker and pages update, and caches build output for a year', () => {
    expect(at('/sw.js')['cache-control']).toBe('no-cache');
    for (const path of ['/', '/privacy/', '/tools/invoice/', '/business/']) {
      expect(at(path)['cache-control']).toBe('public, max-age=0, must-revalidate');
    }
    expect(at('/_next/static/chunks/a.js')['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(at('/fonts/invoice/Inter-Regular.ttf')['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('never sends two cache rules for one file', () => {
    for (const path of ['/', '/sw.js', '/manifest.webmanifest', '/privacy/', '/_next/static/a/b.js', '/fonts/invoice/x.ttf', '/robots.txt']) {
      expect(at(path)['cache-control']).not.toContain(', public');
      expect(at(path)['cache-control']).not.toContain(', no-cache');
    }
  });

  it('keeps sw.js at the site root so its scope is the whole site', () => {
    expect(readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8')).toContain('__BUILD_ID__');
    expect(rules.some((rule) => rule.pattern === '/sw.js')).toBe(true);
  });
});
