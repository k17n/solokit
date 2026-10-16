'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InvoiceKind, SellerProfile } from '@solokit/tool-invoice';
import { Button, Notice } from '@solokit/ui';
import { BackupScreen } from './BackupScreen';
import { InvoiceEditor } from './InvoiceEditor';
import { InvoiceList } from './InvoiceList';
import { InvoiceViewer } from './InvoiceViewer';
import { Onboarding } from './Onboarding';
import { ThemesScreen } from './ThemesScreen';
import { ProfileForm } from './ProfileForm';
import { profileToForm } from './profileFormState';
import { requestPersistentStorage } from './persist';
import type { PdfRenderer } from './usePdfPreview';
import { useInvoiceStorage } from './useInvoiceStorage';
import styles from './InvoiceApp.module.css';

type View = { name: 'list' } | { name: 'new'; kind: InvoiceKind } | { name: 'edit'; id: string } | { name: 'view'; id: string } | { name: 'profile' } | { name: 'themes' } | { name: 'backup' };

const TABS: { label: string; target: View; current: View['name'][] }[] = [
  { label: 'Invoices', target: { name: 'list' }, current: ['list', 'view'] },
  { label: 'New invoice', target: { name: 'new', kind: 'invoice' }, current: ['new', 'edit'] },
  { label: 'Themes', target: { name: 'themes' }, current: ['themes'] },
  { label: 'Backup & restore', target: { name: 'backup' }, current: ['backup'] },
  { label: 'Profile', target: { name: 'profile' }, current: ['profile'] },
];

export function InvoiceApp({ renderPdf, now }: { renderPdf?: PdfRenderer; now?: () => Date } = {}) {
  const { storage, store, ready, persistent } = useInvoiceStorage();
  const [profile, setProfile] = useState<SellerProfile | null | undefined>(undefined);
  const [view, setView] = useState<View>({ name: 'list' });
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  /** Changes every time "New invoice" is chosen, so the editor starts fresh even when it is already open. */
  const [newCount, setNewCount] = useState(0);
  const [restoring, setRestoring] = useState(false);
  /** Shown after a restore from the first-run screen, because that screen is gone by then. */
  const [restoredNotice, setRestoredNotice] = useState<{ hasProfile: boolean } | null>(null);
  const restoredRef = useRef<HTMLDivElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const asked = useRef(false);

  useEffect(() => {
    if (restoredNotice) restoredRef.current?.focus();
  }, [restoredNotice]);

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

  const saveProfile = useCallback(
    async (next: SellerProfile) => {
      if (!storage) return;
      await storage.profile.save(next);
      setRestoredNotice(null);
      try {
        await storage.settings.update({ onboarded: true });
      } catch (error) {
        // The profile is saved; losing the flag must not keep the user on onboarding.
        console.error('Could not record that setup is finished', error);
      }
      setProfile(next);
    },
    [storage],
  );

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

  const storageWarning = !persistent ? (
    <Notice tone="danger" title="Your browser is not saving data">
      {profile === null
        ? 'What you enter, or restore from a backup, will be lost when you close this tab. Use a normal browser window so your work is kept.'
        : 'What you enter will be lost when you close this tab. Use a normal browser window so your work is kept, or download a backup from the Backup & restore tab before you leave.'}
    </Notice>
  ) : null;
  const restoredBanner = restoredNotice ? (
    <div ref={restoredRef} tabIndex={-1}>
      <Notice tone="info" title="Backup restored">
        {restoredNotice.hasProfile
          ? 'Your invoices, clients, themes and settings are back on this device.'
          : 'The backup had no business profile. Complete setup below to start using SoloKit.'}
      </Notice>
    </div>
  ) : null;

  if (profile === null) {
    return (
      <div className={styles.app}>
        {storageWarning}
        {restoredBanner}
        {restoring && store ? (
          <>
            <div>
              <Button variant="ghost" onClick={() => setRestoring(false)}>
                Back to setup
              </Button>
            </div>
            <BackupScreen
              store={store}
              restoreOnly
              onRestored={(summary) => {
                setRestoredNotice({ hasProfile: summary.hasProfile });
                setRestoring(false);
                setLoadAttempt((attempt) => attempt + 1);
              }}
              {...(now ? { now } : {})}
            />
          </>
        ) : (
          <>
            <Onboarding onDone={saveProfile} />
            <div>
              <Button variant="ghost" onClick={() => setRestoring(true)}>
                Already use SoloKit? Restore a backup
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.app}>
      {storageWarning}
      {restoredBanner}
      <nav aria-label="Invoice tool">
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              aria-current={tab.current.includes(view.name) ? 'page' : undefined}
              className={styles.tab}
              onClick={() => {
                if (tab.target.name === 'new') setNewCount((count) => count + 1);
                setView(tab.target);
                setSavedNotice(false);
                setRestoredNotice(null);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      <div className={styles.panel}>
        {view.name === 'list' ? (
          <InvoiceList
            storage={storage}
            onNew={(kind = 'invoice') => {
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
        {view.name === 'themes' ? <ThemesScreen storage={storage} profile={profile} {...(renderPdf ? { renderPdf } : {})} {...(now ? { now } : {})} /> : null}
        {view.name === 'backup' && store ? (
          <BackupScreen store={store} onRestored={() => setLoadAttempt((attempt) => attempt + 1)} {...(now ? { now } : {})} />
        ) : null}
        {view.name === 'profile' ? (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {savedNotice ? <Notice tone="info">Saved</Notice> : null}
            <ProfileForm
              key={saveCount}
              initial={profileToForm(profile)}
              submitLabel="Save changes"
              onSave={async (next) => {
                setSavedNotice(false);
                await saveProfile(next);
                setSavedNotice(true);
                setSaveCount((count) => count + 1);
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
