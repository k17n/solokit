import type { Metadata } from 'next';
import { PageShell } from '../../src/components/PageShell';
import { AppHomeLoader } from '../../src/app-home/AppHomeLoader';

export const metadata: Metadata = {
  title: 'Your tools',
  description: 'The SoloKit tools your business can use, with what is saved in each.',
  // The start of the app, not a page to land on from a search.
  robots: { index: false },
};

export default function AppHomeRoute() {
  return (
    <PageShell eyebrow="Your workspace" title="Your tools" lede="Everything here uses your business details and stays on this device." wide compact>
      <AppHomeLoader />
    </PageShell>
  );
}
