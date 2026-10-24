'use client';

import dynamic from 'next/dynamic';
import { WorkspaceStore } from '../workspace/WorkspaceProvider';

// Client-only and loaded on demand, like the tools.
const SetupPage = dynamic(() => import('./SetupPage').then((module) => module.SetupPage), {
  ssr: false,
  loading: () => <p>Opening your business…</p>,
});

export function SetupPageLoader() {
  return (
    <WorkspaceStore>
      <SetupPage />
      <noscript>This page needs JavaScript. Turn it on in your browser settings to use it.</noscript>
    </WorkspaceStore>
  );
}
