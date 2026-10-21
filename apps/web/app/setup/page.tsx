import type { Metadata } from 'next';
import { PageShell } from '../../src/components/PageShell';
import { SetupPageLoader } from '../../src/setup/SetupPageLoader';

export const metadata: Metadata = {
  title: 'Set up your business',
  description: 'Enter your business details once. Every SoloKit tool uses them, and they stay on this device.',
  // A step in the app, not a page to land on from a search.
  robots: { index: false },
};

export default function SetupRoute() {
  return (
    <PageShell eyebrow="Your business" title="Business setup" wide>
      <SetupPageLoader />
    </PageShell>
  );
}
