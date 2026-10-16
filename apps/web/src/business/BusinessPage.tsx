'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { missingFields, type BusinessProfile } from '@solokit/profile';
import { Notice } from '@solokit/ui';
import { useInvoiceStorage } from '../invoice/useInvoiceStorage';
import { WorkspaceStore, useWorkspaces } from '../workspace/WorkspaceProvider';
import { AddBusiness } from './AddBusiness';
import { BackupScreen } from './BackupScreen';
import { BrandThemeCard } from './BrandThemeCard';
import { ManageBusinesses } from './ManageBusinesses';
import { ProfileForm } from './ProfileForm';
import { emptyProfileForm, profileToForm } from './profileFormState';
import { TOOL_LABELS } from './usage';
import { useProfileSaver } from './useProfileSaver';
import styles from './BusinessPage.module.css';

type Hash = '' | 'add' | 'details' | 'backup' | 'businesses';

function readHash(): Hash {
  if (typeof window === 'undefined') return '';
  const value = window.location.hash.replace(/^#/, '');
  return value === 'add' || value === 'details' || value === 'backup' || value === 'businesses' ? value : '';
}

export interface BusinessPageProps {
  now?: () => Date;
}

/**
 * The platform-level Business page: details, logo and brand colours, payments and defaults for the current Business;
 * backup and restore for it; and the list of all Businesses. `#add` swaps the page for the "Add a business" flow.
 */
export function BusinessPage({ now }: BusinessPageProps = {}) {
  const { ready } = useWorkspaces();
  const [hash, setHash] = useState<Hash>('');

  useEffect(() => {
    setHash(readHash());
    const onChange = () => setHash(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  // The page is drawn after the browser has looked for the anchor, so scroll to the section and focus its heading here.
  useEffect(() => {
    if (!ready || hash === '' || hash === 'add') return;
    const section = document.getElementById(hash);
    if (!section) return;
    section.scrollIntoView?.({ block: 'start' });
    const heading = section.querySelector<HTMLElement>('h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [ready, hash]);

  const leaveAdd = useCallback(() => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setHash('');
  }, []);

  if (!ready) return <p>Opening your businesses…</p>;

  if (hash === 'add') return <AddBusiness onCreated={leaveAdd} onCancel={leaveAdd} />;

  return (
    <div className={styles.page}>
      <nav aria-label="On this page" className={styles.jump}>
        <a href="#details">This business</a>
        <a href="#backup">Backup &amp; restore</a>
        <a href="#businesses">Your businesses</a>
      </nav>
      {/* Keyed by the Business, so the details and backup start afresh when it changes. */}
      <WorkspaceStore>
        <CurrentBusiness {...(now ? { now } : {})} />
      </WorkspaceStore>
      <div id="businesses" className={styles.anchor}>
        <ManageBusinesses {...(now ? { now } : {})} />
      </div>
    </div>
  );
}

function CurrentBusiness({ now }: BusinessPageProps) {
  const { storage, store, ready, persistent } = useInvoiceStorage();
  const { current } = useWorkspaces();
  const detailsId = useId();
  const [profile, setProfile] = useState<BusinessProfile | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(false);
  /** Changes when the form should start again from what is saved: after a save or after the data was reloaded. */
  const [formKey, setFormKey] = useState(0);
  const savedRef = useRef<HTMLParagraphElement>(null);
  const saveBusiness = useProfileSaver(storage);

  useEffect(() => {
    if (!storage) return;
    let cancelled = false;
    setLoadFailed(false);
    storage.profile.get().then(
      (found) => {
        if (!cancelled) {
          setProfile(found ?? null);
          setFormKey((count) => count + 1);
        }
      },
      (error: unknown) => {
        console.error('Could not read the saved profile', error);
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [storage, attempt]);

  useEffect(() => {
    if (saved) savedRef.current?.focus();
  }, [saved]);

  if (loadFailed) {
    return (
      <Notice tone="danger" title="Your saved details could not be opened">
        Your browser could not read what was saved on this device. Reload the page. If it keeps happening, your data may be damaged.
      </Notice>
    );
  }
  if (!ready || !storage || !store || !current || profile === undefined) return <p>Opening your business…</p>;

  const fresh = profile === null;
  const initial = fresh ? { ...emptyProfileForm('unregistered'), gstUnconfirmed: true, name: current.name } : profileToForm(profile);
  const gaps = profile ? missingFields(profile, 'invoice').length + missingFields(profile, 'contract').length : 0;

  return (
    <>
      {!persistent ? (
        <Notice tone="danger" title="Your browser is not saving data">
          What you enter will be lost when you close this tab. Use a normal browser window so your work is kept, or download a backup below before you leave.
        </Notice>
      ) : null}

      <section id="details" className={styles.section} aria-labelledby={`${detailsId}-title`}>
        <div>
          <h2 id={`${detailsId}-title`} tabIndex={-1} className={styles.heading}>
            {fresh ? `Set up ${current.name}` : 'This business'}
          </h2>
          <p className={styles.lede}>
            {fresh ? (
              <>
                Tell SoloKit about <strong>{current.name}</strong> once. {Object.values(TOOL_LABELS).join(' and ')} fill themselves in from it.
              </>
            ) : (
              <>
                You are working in <strong>{current.name}</strong>. These details belong to this business only, and every tool that needs them reads them from here.
              </>
            )}
          </p>
        </div>
        {saved ? (
          <p role="status" tabIndex={-1} ref={savedRef} className={styles.saved}>
            Saved. {gaps > 0 ? 'Some tools may still ask for a detail or two when you open them.' : 'Every tool can use these details now.'}
          </p>
        ) : null}
        <ProfileForm
          key={formKey}
          idPrefix="business"
          initial={initial}
          submitLabel={fresh ? 'Save and continue' : 'Save changes'}
          brandThemeSlot={(draftBrand) => (profile ? <BrandThemeCard storage={storage} profile={profile} draftBrand={draftBrand} onChanged={setProfile} /> : null)}
          onSave={async (next) => {
            setSaved(false);
            const savedProfile = await saveBusiness(next, profile);
            setProfile(savedProfile);
            setSaved(true);
            setFormKey((count) => count + 1);
          }}
        />
      </section>

      <section id="backup" className={styles.section}>
        <BackupScreen store={store} onRestored={() => setAttempt((count) => count + 1)} {...(now ? { now } : {})} />
      </section>
    </>
  );
}
