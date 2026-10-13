'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SellerProfile } from '@solokit/tool-invoice';
import { Button, Notice } from '@solokit/ui';
import { Onboarding } from './Onboarding';
import { ProfileForm } from './ProfileForm';
import { profileToForm } from './profileFormState';
import { requestPersistentStorage } from './persist';
import { useInvoiceStorage } from './useInvoiceStorage';
import styles from './InvoiceApp.module.css';

type ViewName = 'list' | 'profile';

const TABS: { name: ViewName; label: string }[] = [
  { name: 'list', label: 'Invoices' },
  { name: 'profile', label: 'Profile' },
];

export function InvoiceApp() {
  const { storage, ready, persistent } = useInvoiceStorage();
  const [profile, setProfile] = useState<SellerProfile | null | undefined>(undefined);
  const [view, setView] = useState<ViewName>('list');
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
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

  const saveProfile = useCallback(
    async (next: SellerProfile) => {
      if (!storage) return;
      await storage.profile.save(next);
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

  if (!ready || profile === undefined) return <p>Opening your invoices…</p>;

  const storageWarning = !persistent ? (
    <Notice tone="danger" title="Your browser is not saving data">
      What you enter will be lost when you close this tab. Use a normal browser window so your work is kept.
    </Notice>
  ) : null;

  if (profile === null) {
    return (
      <div className={styles.app}>
        {storageWarning}
        <Onboarding onDone={saveProfile} />
      </div>
    );
  }

  return (
    <div className={styles.app}>
      {storageWarning}
      <nav aria-label="Invoice tool">
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.name}
              type="button"
              aria-current={view === tab.name ? 'page' : undefined}
              className={styles.tab}
              onClick={() => {
                setView(tab.name);
                setSavedNotice(false);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      <div className={styles.panel}>
        {view === 'list' ? (
          <p className={styles.empty}>Your invoices will appear here.</p>
        ) : (
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
        )}
      </div>
    </div>
  );
}
