import type { Metadata } from 'next';
import { Forward } from '../../../src/components/Forward';
import { PageShell } from '../../../src/components/PageShell';
import { BUSINESS_PATH } from '../../../src/paths';

export const metadata: Metadata = { title: 'Your business', robots: { index: false } };

/** The old address of Your business, from before the app moved under /app/. */
export default function OldBusinessRoute() {
  return (
    <PageShell title="Your business">
      <Forward to={BUSINESS_PATH} label="Your business" />
    </PageShell>
  );
}
