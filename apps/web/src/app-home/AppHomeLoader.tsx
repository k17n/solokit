'use client';

import dynamic from 'next/dynamic';
import { WorkspaceStore } from '../workspace/WorkspaceProvider';

// Client-only and loaded on demand, like the tools.
const AppHome = dynamic(() => import('./AppHome').then((module) => module.AppHome), {
  ssr: false,
  loading: () => <p>Opening your tools…</p>,
});

export function AppHomeLoader() {
  return (
    <WorkspaceStore>
      <AppHome />
      <noscript>SoloKit needs JavaScript. Turn it on in your browser settings to use it.</noscript>
    </WorkspaceStore>
  );
}
