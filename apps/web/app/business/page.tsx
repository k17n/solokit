import type { Metadata } from 'next';
import { PageShell } from '../../src/components/PageShell';
import { BusinessPageLoader } from '../../src/business/BusinessPageLoader';

export const metadata: Metadata = {
  title: 'Your business',
  description: 'Your business details, logo and brand colours, entered once and used by every SoloKit tool. Backups and separate businesses live here too.',
};

export default function BusinessRoute() {
  return (
    <PageShell
      eyebrow="Shared by every tool"
      title="Your business"
      lede="Enter your details, logo and brand colours once. The invoice and contract tools read them from here. Everything stays on this device."
      wide
    >
      <BusinessPageLoader />
    </PageShell>
  );
}
