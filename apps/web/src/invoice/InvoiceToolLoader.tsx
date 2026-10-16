'use client';

import dynamic from 'next/dynamic';
import { WorkspaceProvider } from '../workspace/WorkspaceProvider';

// The invoice tool is client-only and loaded on demand, so the home page and the other tool pages stay light.
const InvoiceApp = dynamic(() => import('./InvoiceApp').then((module) => module.InvoiceApp), {
  ssr: false,
  loading: () => <p>Opening your invoices…</p>,
});

export function InvoiceToolLoader() {
  return (
    <WorkspaceProvider>
      <InvoiceApp />
      <noscript>The invoice tool needs JavaScript. Turn it on in your browser settings to use it.</noscript>
    </WorkspaceProvider>
  );
}
