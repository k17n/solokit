import '@solokit/ui/tokens.css';
import type { Metadata, Viewport } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { BRAND, SiteFooter, SiteHeader } from '@solokit/ui';
import { Analytics } from '../src/analytics';
import { ServiceWorkerRegister } from '../src/ServiceWorkerRegister';
import { siteMetadata } from '../src/seo';
import { HEADER_PROPS, getFooterProps } from '../src/site';
import { AppProviders } from '../src/workspace/AppProviders';
import { BusinessSwitcher } from '../src/workspace/BusinessSwitcher';

const sans = Geist({ subsets: ['latin', 'latin-ext'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin', 'latin-ext'], variable: '--font-mono' });

export const metadata: Metadata = siteMetadata();

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <AppProviders>
          <SiteHeader {...HEADER_PROPS} extra={<BusinessSwitcher />} />
          {children}
          <SiteFooter {...getFooterProps()} />
        </AppProviders>
        <ServiceWorkerRegister />
        <Analytics />
      </body>
    </html>
  );
}
