import { describe, expect, it } from 'vitest';
import { buildId, collectUrls } from '../scripts/sw-precache.mjs';

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
      '404.html',
    ];
    expect(collectUrls(files)).toEqual(files.map((f) => `/${f}`).sort());
  });

  it('accepts windows separators', () => {
    expect(collectUrls(['a\\b\\index.html', '_next\\x.js'])).toEqual(['/_next/x.js', '/a/b/']);
  });

  it('excludes sw.js and source maps, and dedupes', () => {
    expect(collectUrls(['sw.js', '_next/a.js.map', 'x.js', 'x.js', 'index.html'])).toEqual(['/', '/x.js']);
  });

  it('returns a sorted array', () => {
    const urls = collectUrls(['z.js', 'a.js', 'm/index.html']);
    expect(urls).toEqual([...urls].sort());
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
