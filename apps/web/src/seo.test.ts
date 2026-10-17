import { describe, expect, it } from 'vitest';
import robots from '../app/robots';
import sitemap from '../app/sitemap';
import { DEFAULT_SITE_URL, absoluteUrl, getSiteUrl, siteMetadata, sitemapPaths } from './seo';

describe('site url', () => {
  it('falls back to a placeholder and strips trailing slashes', () => {
    expect(getSiteUrl(undefined)).toBe(DEFAULT_SITE_URL);
    expect(getSiteUrl('  ')).toBe(DEFAULT_SITE_URL);
    expect(getSiteUrl('https://solokit.app/')).toBe('https://solokit.app');
  });

  it('refuses a value that is not an http(s) address', () => {
    expect(getSiteUrl('javascript:alert(1)')).toBe(DEFAULT_SITE_URL);
    expect(getSiteUrl('solokit.app')).toBe(DEFAULT_SITE_URL);
  });

  it('builds absolute addresses with a trailing slash path', () => {
    expect(absoluteUrl('/privacy/', 'https://solokit.app')).toBe('https://solokit.app/privacy/');
    expect(absoluteUrl('/', 'https://solokit.app')).toBe('https://solokit.app/');
  });
});

describe('sitemap', () => {
  it('lists home, business, privacy and only the tools that are available', () => {
    const paths = sitemapPaths();
    expect(paths.slice(0, 3)).toEqual(['/', '/business/', '/privacy/']);
    expect(paths).toContain('/tools/invoice/');
    expect(paths).toContain('/tools/contract/');
    expect(paths).not.toContain('/tools/qr-code/');
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('is exposed to Next with absolute urls', () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls.every((url) => url.startsWith(DEFAULT_SITE_URL))).toBe(true);
    expect(urls).toContain(`${DEFAULT_SITE_URL}/tools/invoice/`);
  });
});

describe('robots', () => {
  it('allows everything and points at the sitemap', () => {
    const result = robots();
    expect(result.rules).toEqual({ userAgent: '*', allow: '/' });
    expect(result.sitemap).toBe(`${DEFAULT_SITE_URL}/sitemap.xml`);
  });
});

describe('site metadata', () => {
  it('sets a base url, a title and description, and share previews', () => {
    const meta = siteMetadata();
    expect(String(meta.metadataBase)).toBe(`${DEFAULT_SITE_URL}/`);
    expect(meta.description).toMatch(/free invoice, quote and contract tools/i);
    expect(meta.openGraph).toMatchObject({ type: 'website', siteName: 'SoloKit', locale: 'en_IN' });
    expect(meta.twitter).toMatchObject({ card: 'summary' });
    expect(typeof (meta.title as { default: string }).default).toBe('string');
  });
});
