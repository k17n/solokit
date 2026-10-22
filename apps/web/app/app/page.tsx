import type { Metadata } from 'next';
import { AppHomeLoader } from '../../src/app-home/AppHomeLoader';

export const metadata: Metadata = {
  title: 'Home',
  description: 'Your SoloKit home: search the tools, start a document, and pick up where you left off.',
  // The start of the app, not a page to land on from a search.
  robots: { index: false },
};

export default function AppHomeRoute() {
  return (
    <main id="main" className="container">
      <AppHomeLoader />
    </main>
  );
}
