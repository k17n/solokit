import '@solokit/ui/tokens.css';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Geist, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { BRAND, SiteFooter, SiteHeader } from '@solokit/ui';
import { ServiceWorkerRegister } from '../src/ServiceWorkerRegister';
import { HEADER_PROPS, getFooterProps } from '../src/site';

const display = Bricolage_Grotesque({ subsets: ['latin', 'latin-ext'], variable: '--font-display' });
const sans = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: { default: `${BRAND.name}: free tools for freelancers and solopreneurs`, template: `%s | ${BRAND.name}` },
  description:
    'Free invoice, quote and contract tools that run in your browser. India GST ready. No signup, works offline, and your data stays on your device.',
  applicationName: BRAND.name,
  manifest: '/manifest.webmanifest',
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1428' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader {...HEADER_PROPS} />
        {children}
        <SiteFooter {...getFooterProps()} />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
