import type { Metadata } from 'next';
import { getTools, toolHref } from '@solokit/registry';
import { BRAND } from '@solokit/ui';

export const DEFAULT_SITE_URL = 'https://solokit.example';

/** The public address of the site, from NEXT_PUBLIC_SITE_URL at build time. No trailing slash. */
export function getSiteUrl(value: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  const trimmed = value?.trim() ?? '';
  if (!/^https?:\/\//i.test(trimmed)) return DEFAULT_SITE_URL;
  return trimmed.replace(/\/+$/, '');
}

export function absoluteUrl(path: string, siteUrl: string = getSiteUrl()): string {
  return `${siteUrl}${path}`;
}

/** Pages worth indexing: the fixed pages and every tool that is ready (coming-soon tools are left out). */
export function sitemapPaths(): string[] {
  const tools = getTools()
    .filter((tool) => tool.status === 'available')
    .map((tool) => toolHref(tool.slug));
  return ['/', '/business/', '/privacy/', ...tools];
}

const TITLE = `${BRAND.name}: free tools for freelancers and solopreneurs`;
const DESCRIPTION =
  'Free invoice, quote and contract tools that run in your browser. India GST ready. No signup, works offline, and your data stays on your device.';

/** Site-wide metadata for the root layout; pages add their own title and description on top. */
export function siteMetadata(): Metadata {
  return {
    metadataBase: new URL(getSiteUrl()),
    title: { default: TITLE, template: `%s | ${BRAND.name}` },
    description: DESCRIPTION,
    applicationName: BRAND.name,
    manifest: '/manifest.webmanifest',
    icons: { apple: '/icons/apple-touch-icon.png' },
    openGraph: { type: 'website', siteName: BRAND.name, title: TITLE, description: DESCRIPTION, locale: 'en_IN' },
    twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
  };
}
