'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { WorkspacesProvider } from './WorkspaceProvider';

/** Pages that use a Business. The home page and the privacy page read and create nothing. */
export function usesBusiness(pathname: string | null): boolean {
  return pathname !== null && (pathname.startsWith('/tools/') || pathname === '/business' || pathname.startsWith('/business/'));
}

/** Wraps the whole page, header and footer included, so the Business switcher in the header and the tool below share one list of Businesses. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <WorkspacesProvider enabled={usesBusiness(usePathname())}>{children}</WorkspacesProvider>;
}
