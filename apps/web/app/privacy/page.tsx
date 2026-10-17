import type { Metadata } from 'next';
import { PageShell } from '../../src/components/PageShell';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'SoloKit keeps your business data on your device and only counts visits, without cookies. Here is exactly what that means.',
};

export default function PrivacyPage() {
  return (
    <PageShell
      eyebrow="How it works"
      title="Privacy"
      lede="Your business data stays on your device. The only thing the site measures is how many people visit, and it does that without cookies."
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
        There are no accounts and no cookies. Nothing you type, none of your clients, invoices or agreements, and no backup
        file is ever sent to us or to anyone else. Fonts are served from this site rather than from a third party.
      </p>

      <h2>Counting visits</h2>
      <p>
        To see how many people use each tool, the site counts visits with Cloudflare Web Analytics. It works without cookies
        and does not store your IP address or build a profile of you. A visit records which page, the page you came from,
        your country, and the type of device and browser, plus how fast the page loaded. It never reads anything on the
        tool screens, so never anything you type.
      </p>
      <p>
        If your browser sends Do Not Track or Global Privacy Control, the counting script is not loaded at all. It also is
        not loaded when you use the installed app offline, and the site works the same without it.
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
