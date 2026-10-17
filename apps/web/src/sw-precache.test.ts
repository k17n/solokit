import { describe, expect, it } from 'vitest';
import { buildId, collectUrls, injectPrecache } from '../scripts/sw-precache.mjs';

describe('collectUrls', () => {
  it('maps index.html files to directory URLs', () => {
    expect(collectUrls(['index.html', 'privacy/index.html', 'a/b/index.html'])).toEqual([
      '/',
      '/a/b/',
      '/privacy/',
    ]);
  });

  it('maps other files to their posix path', () => {
    const files = [
      '_next/static/chunks/app.js',
      '_next/static/css/site.css',
      '_next/static/media/f.woff2',
      'privacy/__next.privacy.txt',
      'icons/icon-192.png',
      'manifest.webmanifest',
    ];
    expect(collectUrls(files)).toEqual(files.map((f) => `/${f}`).sort());
  });

  it('accepts windows separators', () => {
    expect(collectUrls(['a\\b\\index.html', '_next\\x.js'])).toEqual(['/_next/x.js', '/a/b/']);
  });

  it('excludes host configuration files that a static host does not serve', () => {
    expect(collectUrls(['_headers', '_redirects', 'index.html', 'robots.txt', 'sitemap.xml'])).toEqual(['/']);
  });

  it('excludes sw.js and source maps, and dedupes', () => {
    expect(collectUrls(['sw.js', '_next/a.js.map', 'x.js', 'x.js', 'index.html'])).toEqual(['/', '/x.js']);
  });

  it('returns a sorted array', () => {
    const urls = collectUrls(['z.js', 'a.js', 'm/index.html']);
    expect(urls).toEqual([...urls].sort());
  });
});

describe('collectUrls error pages', () => {
  const real = ['index.html', 'privacy/index.html', 'tools/invoice/index.html', '_next/static/media/f.woff2'];
  const errors = [
    '404.html',
    '404/index.html',
    '_not-found.html',
    '_not-found.txt',
    '_not-found/index.html',
    '_not-found/__next._full.txt',
  ];

  it('excludes 404 and _not-found files but keeps real pages and assets', () => {
    expect(collectUrls([...real, ...errors])).toEqual(
      ['/', '/privacy/', '/tools/invoice/', '/_next/static/media/f.woff2'].sort(),
    );
  });

  it('excludes them with windows separators too', () => {
    const win = [...real, ...errors].map((f) => f.replaceAll('/', String.fromCharCode(92)));
    expect(collectUrls(win)).toEqual(
      ['/', '/privacy/', '/tools/invoice/', '/_next/static/media/f.woff2'].sort(),
    );
  });
});

describe('injectPrecache', () => {
  const tpl = "const A='__BUILD_ID__';const U=__PRECACHE_URLS__;const B='__BUILD_ID__';const V=__PRECACHE_URLS__;";

  it('keeps $ patterns verbatim', () => {
    const urls = ['/a/$&/', '/b/$$/', "/c/$'/", '/d/$`/'];
    const out = injectPrecache(tpl, 'id$&x', urls);
    expect(out).toContain(JSON.stringify(urls));
    expect(out).toContain("'id$&x'");
  });

  it('replaces every occurrence of both tokens', () => {
    const out = injectPrecache(tpl, 'abc', ['/']);
    expect(out).not.toContain('__BUILD_ID__');
    expect(out).not.toContain('__PRECACHE_URLS__');
    expect(out.split("'abc'")).toHaveLength(3);
    expect(out.split('["/"]')).toHaveLength(3);
  });

  it('throws a clear error when a token is missing', () => {
    expect(() => injectPrecache('const U=__PRECACHE_URLS__;', 'x', [])).toThrow(/__BUILD_ID__/);
    expect(() => injectPrecache("const A='__BUILD_ID__';", 'x', [])).toThrow(/__PRECACHE_URLS__/);
  });

  it('produces valid JS whose data round-trips', () => {
    const urls = ['/', '/a/$&/', '/_next/static/media/f.woff2'];
    const out = injectPrecache('return [__BUILD_ID__, __PRECACHE_URLS__];'.replace('__BUILD_ID__', "'__BUILD_ID__'"), 'id1', urls);
    expect(() => new Function(out)).not.toThrow();
    expect(new Function(out)()).toEqual(['id1', urls]);
  });
});

describe('buildId', () => {
  const entries = [
    { url: '/', hash: 'aaa' },
    { url: '/x.js', hash: 'bbb' },
  ];

  it('is 12 hex chars and deterministic', () => {
    expect(buildId(entries)).toMatch(/^[0-9a-f]{12}$/);
    expect(buildId(entries)).toBe(buildId(entries.map((e) => ({ ...e }))));
  });

  it('is order independent', () => {
    expect(buildId([...entries].reverse())).toBe(buildId(entries));
  });

  it('changes when a hash changes', () => {
    expect(buildId([entries[0]!, { url: '/x.js', hash: 'ccc' }])).not.toBe(buildId(entries));
  });
});
