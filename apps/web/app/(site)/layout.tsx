import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '@solokit/ui';
import { HEADER_PROPS, getFooterProps } from '../../src/site';

/** The static site: home, privacy and the tool landing pages. The app under /app/ has its own shell. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader {...HEADER_PROPS} />
      {children}
      <SiteFooter {...getFooterProps()} />
    </>
  );
}
