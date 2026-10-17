import type { MetadataRoute } from 'next';
import { absoluteUrl, sitemapPaths } from '../src/seo';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapPaths().map((path) => ({ url: absoluteUrl(path) }));
}
