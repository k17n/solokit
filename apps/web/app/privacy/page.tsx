import type { Metadata } from 'next';
import { PageShell } from '../../src/components/PageShell';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'SoloKit keeps your data on your device. Here is exactly what that means.',
};

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="How it works"
      title="Privacy"
      lede="SoloKit is built so that your business data never needs to leave your device."
    >
      <h2>What stays on your device</h2>
      <p>
        Your business details, clients, invoices, agreements and themes are saved in your browser's own storage (IndexedDB).
        They are read and written by the page on your device. There is no SoloKit server that receives them.
      </p>
      <p>
        Each business you add on the Your business page is a separate database in your browser, so nothing is shared between
        businesses. Deleting a business erases its data from this device only. Any backup file you downloaded stays where you
        saved it, so delete those yourself if you want them gone.
      </p>

      <h2>What we do not collect</h2>
      <p>
        There are no accounts, no cookies and no analytics scripts on this site today. Fonts are served from this site
        rather than from a third party, so visiting does not send your address to anyone else.
      </p>

      <h2>Back up your data</h2>
      <p>
        Because the data lives in your browser, clearing your browser data erases it. On the Your business page (or in a
        tool's Backup &amp; restore tab), download a backup file regularly and keep it somewhere safe. A backup covers one
        business and records its name. You can restore it on any device, either as a new business or in place of the
        current one. The file is not encrypted and contains your bank details and clients, so treat it like a bank
        statement.
      </p>

      <h2>Tax information</h2>
      <p>
        The GST and TDS calculations follow rules that were last checked on the date shown in the footer. They are not
        tax advice; confirm anything important with your chartered accountant.
      </p>
    </PageShell>
  );
}
