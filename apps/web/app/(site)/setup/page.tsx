import type { Metadata } from 'next';
import { Forward } from '../../../src/components/Forward';
import { PageShell } from '../../../src/components/PageShell';
import { SETUP_PATH } from '../../../src/paths';

export const metadata: Metadata = { title: 'Business setup', robots: { index: false } };

/** The old address of the business setup, from before the app moved under /app/. */
export default function OldSetupRoute() {
  return (
    <PageShell title="Business setup">
      <Forward to={SETUP_PATH} label="Business setup" />
    </PageShell>
  );
}
