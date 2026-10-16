'use client';

import dynamic from 'next/dynamic';
import { WorkspacesProvider } from '../workspace/WorkspaceProvider';
import { useOptionalWorkspaces } from '../workspace/WorkspaceProvider';

// The page is client-only and loaded on demand, like the tools.
const BusinessPage = dynamic(() => import('./BusinessPage').then((module) => module.BusinessPage), {
  ssr: false,
  loading: () => <p>Opening your business…</p>,
});

export function BusinessPageLoader() {
  // The site layout provides the list of businesses; this only makes one if the page is shown on its own.
  const provided = useOptionalWorkspaces() !== null;
  const page = (
    <>
      <BusinessPage />
      <noscript>This page needs JavaScript. Turn it on in your browser settings to use it.</noscript>
    </>
  );
  return provided ? page : <WorkspacesProvider>{page}</WorkspacesProvider>;
}
