'use client';

import { useEffect, useRef, useState } from 'react';
import type { InvoiceKind } from '@solokit/tool-invoice';
import { missingForSetup, type BusinessProfile } from '@solokit/profile';
import { toolHref } from '@solokit/registry';
import { Button, Notice } from '@solokit/ui';
import { BackupScreen } from '../business/BackupScreen';
import { setupHref } from '../setup/links';
import { SetupRequired } from '../setup/SetupRequired';
import { InvoiceEditor } from './InvoiceEditor';
import { InvoiceList } from './InvoiceList';
import { InvoiceViewer } from './InvoiceViewer';
import { ThemesScreen } from './ThemesScreen';
import { requestPersistentStorage } from './persist';
import type { PdfRenderer } from './usePdfPreview';
import { useInvoiceStorage } from './useInvoiceStorage';
import styles from './InvoiceApp.module.css';

type View = { name: 'list' } | { name: 'new'; kind: InvoiceKind } | { name: 'edit'; id: string } | { name: 'view'; id: string } | { name: 'themes' } | { name: 'backup' };

const TABS: { label: string; target: View; current: View['name'][] }[] = [
  { label: 'Documents', target: { name: 'list' }, current: ['list', 'view', 'new', 'edit'] },
  { label: 'Themes', target: { name: 'themes' }, current: ['themes'] },
  { label: 'Backup & restore', target: { name: 'backup' }, current: ['backup'] },
];

const HOME = toolHref('invoice');

export function InvoiceApp({ renderPdf, now }: { renderPdf?: PdfRenderer; now?: () => Date } = {}) {
  const { storage, store, ready, persistent } = useInvoiceStorage();
  const [profile, setProfile] = useState<BusinessProfile | null | undefined>(undefined);
  const [view, setView] = useState<View>({ name: 'list' });
  /** Changes every time a new document is started, so the editor starts fresh even when it is already open. */
  const [newCount, setNewCount] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const asked = useRef(false);

  useEffect(() => {
    if (!storage) return;
    let cancelled = false;
    storage.profile.get().then(
      (found) => {
        if (cancelled) return;
        setLoadFailed(false);
        setProfile(found ?? null);
      },
      (error: unknown) => {
        console.error('Could not read the saved profile', error);
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [storage, loadAttempt]);

  useEffect(() => {
    if (ready && persistent && profile && !asked.current) {
      asked.current = true;
      void requestPersistentStorage();
    }
  }, [ready, persistent, profile]);

  if (loadFailed && profile === undefined) {
    return (
      <div className={styles.app}>
        <Notice tone="danger" title="Your saved details could not be opened">
          Your browser could not read what was saved on this device. Reload the page. If it keeps happening, your data may be damaged.
        </Notice>
        <div>
          <Button
            type="button"
            onClick={() => {
              setLoadFailed(false);
              setLoadAttempt((attempt) => attempt + 1);
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!ready || !storage || profile === undefined) return <p>Opening your invoices…</p>;

  // The business details are entered once, on the setup page, before any tool is used. It brings the person back here.
  if (profile === null || missingForSetup(profile).length > 0) return <SetupRequired returnTo={HOME} />;

  return (
    <div className={styles.app}>
      {!persistent ? (
        <Notice tone="danger" title="Your browser is not saving data">
          What you enter will be lost when you close this tab. Use a normal browser window so your work is kept, or download a backup from the Backup &amp; restore tab before you leave.
        </Notice>
      ) : null}
      <div className={styles.toolbar}>
        <nav aria-label="Invoice tool">
          <div className={styles.tabs}>
            {TABS.map((tab) => (
              <button
                key={tab.label}
                type="button"
                aria-current={tab.current.includes(view.name) ? 'page' : undefined}
                className={styles.tab}
                onClick={() => setView(tab.target)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
        <a className={styles.detailsLink} href={setupHref(HOME)}>
          Business details
        </a>
      </div>
      <div className={styles.panel}>
        {view.name === 'list' ? (
          <InvoiceList
            storage={storage}
            onNew={(kind) => {
              setNewCount((count) => count + 1);
              setView({ name: 'new', kind });
            }}
            onEdit={(id) => setView({ name: 'edit', id })}
            onView={(id) => setView({ name: 'view', id })}
            onOpenBackup={() => setView({ name: 'backup' })}
            {...(renderPdf ? { renderPdf } : {})}
            {...(now ? { now } : {})}
          />
        ) : null}
        {view.name === 'new' || view.name === 'edit' ? (
          <InvoiceEditor
            key={view.name === 'edit' ? view.id : `new-${newCount}`}
            storage={storage}
            profile={profile}
            invoiceId={view.name === 'edit' ? view.id : undefined}
            initialKind={view.name === 'new' ? view.kind : undefined}
            onBack={() => setView({ name: 'list' })}
            onIssued={(id) => setView({ name: 'view', id })}
            {...(renderPdf ? { renderPdf } : {})}
            {...(now ? { now } : {})}
          />
        ) : null}
        {view.name === 'view' ? (
          <InvoiceViewer
            key={view.id}
            storage={storage}
            invoiceId={view.id}
            onBack={() => setView({ name: 'list' })}
            onEdit={(id) => setView({ name: 'edit', id })}
            onView={(id) => setView({ name: 'view', id })}
            {...(renderPdf ? { renderPdf } : {})}
            {...(now ? { now } : {})}
          />
        ) : null}
        {view.name === 'themes' ? <ThemesScreen storage={storage} profile={profile} onProfileChanged={setProfile} {...(renderPdf ? { renderPdf } : {})} {...(now ? { now } : {})} /> : null}
        {view.name === 'backup' && store ? (
          <BackupScreen store={store} onRestored={() => setLoadAttempt((attempt) => attempt + 1)} {...(now ? { now } : {})} />
        ) : null}
      </div>
    </div>
  );
}
