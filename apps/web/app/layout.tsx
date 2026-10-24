import '@solokit/ui/tokens.css';
import type { Metadata, Viewport } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { Analytics } from '../src/analytics';
import { ServiceWorkerRegister } from '../src/ServiceWorkerRegister';
import { siteMetadata } from '../src/seo';
import { AppProviders } from '../src/workspace/AppProviders';

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
        {/* The site's pages and the app under /app/ bring their own header and footer (see their layouts). */}
        <AppProviders>{children}</AppProviders>
        <ServiceWorkerRegister />
        <Analytics />
      </body>
    </html>
  );
}
