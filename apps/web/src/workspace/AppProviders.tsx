'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppPlatform } from '../platform/AppPlatform';
import { WorkspacesProvider } from './WorkspaceProvider';

/** Pages that use a Business. The home page and the privacy page read and create nothing. */
export function usesBusiness(pathname: string | null): boolean {
  if (pathname === null) return false;
  return pathname.startsWith('/tools/') || ['/business', '/setup'].some((page) => pathname === page || pathname.startsWith(`${page}/`));
}

/** Wraps the whole page, header and footer included, so the Business switcher in the header and the tool below share one list of Businesses. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppPlatform>
      <WorkspacesProvider enabled={usesBusiness(usePathname())}>{children}</WorkspacesProvider>
    </AppPlatform>
  );
}
