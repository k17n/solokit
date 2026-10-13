'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SellerProfile } from '@solokit/tool-invoice';
import { Notice } from '@solokit/ui';
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
  const asked = useRef(false);

  useEffect(() => {
    if (!storage) return;
    let cancelled = false;
    void storage.profile.get().then((found) => {
      if (!cancelled) setProfile(found ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

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
      await storage.settings.update({ onboarded: true });
      setProfile(next);
    },
    [storage],
  );

  if (!ready || profile === undefined) return <p>Opening your invoices…</p>;

  const storageWarning = !persistent ? (
    <Notice tone="danger" title="Your browser is not saving data">
      What you enter will be lost when you close this tab. Use a normal browser window, or download a backup before you leave.
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
        <div className={styles.tabs} role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.name}
              type="button"
              role="tab"
              aria-selected={view === tab.name}
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
              initial={profileToForm(profile)}
              submitLabel="Save changes"
              onSave={async (next) => {
                await saveProfile(next);
                setSavedNotice(true);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
