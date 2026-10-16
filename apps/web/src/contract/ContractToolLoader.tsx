'use client';

import dynamic from 'next/dynamic';
import { WorkspaceStore } from '../workspace/WorkspaceProvider';

// The contract tool is client-only and loaded on demand, so the home page and the other tool pages stay light.
const ContractApp = dynamic(() => import('./ContractApp').then((module) => module.ContractApp), {
  ssr: false,
  loading: () => <p>Opening your agreements…</p>,
});

export function ContractToolLoader() {
  return (
    <WorkspaceStore>
      <ContractApp />
      <noscript>The contract tool needs JavaScript. Turn it on in your browser settings to use it.</noscript>
    </WorkspaceStore>
  );
}
