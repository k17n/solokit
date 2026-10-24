'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppPlatform } from '../platform/AppPlatform';
import { WorkspacesProvider } from './WorkspaceProvider';

/** Pages that use a Business: the app, under /app/. The site's pages (home, privacy, tool landing pages) read and create nothing. */
export function usesBusiness(pathname: string | null): boolean {
  return pathname !== null && (pathname === '/app' || pathname.startsWith('/app/'));
}

/** Wraps the whole page, the app shell included, so the Business switcher in the shell and the page below share one list of Businesses. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppPlatform>
      <WorkspacesProvider enabled={usesBusiness(usePathname())}>{children}</WorkspacesProvider>
    </AppPlatform>
  );
}
