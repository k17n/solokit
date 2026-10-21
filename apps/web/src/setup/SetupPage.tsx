'use client';

import { useEffect, useRef, useState } from 'react';
import { missingForSetup, type BusinessProfile } from '@solokit/profile';
import { DEFAULT_WORKSPACE_NAME } from '@solokit/storage';
import { Button, Notice } from '@solokit/ui';
import { BackupScreen } from '../business/BackupScreen';
import { BrandThemeCard } from '../business/BrandThemeCard';
import { ProfileForm, stepOf } from '../business/ProfileForm';
import { emptyProfileForm, profileToForm } from '../business/profileFormState';
import { useProfileSaver } from '../business/useProfileSaver';
import { useInvoiceStorage } from '../invoice/useInvoiceStorage';
import { useStorage } from '../workspace/WorkspaceProvider';
import { AFTER_FIRST_SETUP, isToolPath, readSetupQuery, returnLabel, type SetupStep } from './links';
import { navigate } from './navigate';
import styles from './SetupPage.module.css';

type Mode = 'setup' | 'edit';

/** Setup is finished when every tool has the details it needs. */
const isComplete = (profile: BusinessProfile | null): profile is BusinessProfile => profile !== null && missingForSetup(profile).length === 0;

/**
 * The one place to enter and change the Business's details. The first time it is a step-by-step setup; after that it
 * opens the same steps for editing. Tools send people here (with `?next=` set to the tool) and it sends them back when
 * the details are saved, so no tool has its own copy of the form.
 */
export function SetupPage() {
  const { storage, store, ready, persistent } = useInvoiceStorage();
  const { workspace } = useStorage();
  const [query] = useState(() => readSetupQuery(typeof window === 'undefined' ? '' : window.location.search));
  const [profile, setProfile] = useState<BusinessProfile | null | undefined>(undefined);
  /** Decided when the details are first read (and again after a restore), so it does not flip while saving. */
  const [mode, setMode] = useState<Mode | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const [restoredIncomplete, setRestoredIncomplete] = useState(false);
  const afterRestore = useRef(false);
  const saveBusiness = useProfileSaver(storage);

  const destination = query.next ?? (mode === 'edit' ? '/business/' : AFTER_FIRST_SETUP);

  useEffect(() => {
    if (!storage) return;
    let cancelled = false;
    setLoadFailed(false);
    storage.profile.get().then(
      (found) => {
        if (cancelled) return;
        const loaded = found ?? null;
        setProfile(loaded);
        setMode(isComplete(loaded) ? 'edit' : 'setup');
        if (afterRestore.current) {
          afterRestore.current = false;
          if (isComplete(loaded)) navigate(query.next ?? AFTER_FIRST_SETUP);
          else setRestoredIncomplete(true);
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
  }, [storage, attempt, query.next]);

  if (loadFailed) {
    return (
      <div className={styles.page}>
        <Notice tone="danger" title="Your saved details could not be opened">
          Your browser could not read what was saved on this device. Reload the page. If it keeps happening, your data may be damaged.
        </Notice>
        <div>
          <Button onClick={() => setAttempt((count) => count + 1)}>Try again</Button>
        </div>
      </div>
    );
  }
  if (!ready || !storage || !store || profile === undefined || mode === null) return <p>Opening your business…</p>;

  const warning = !persistent ? (
    <Notice tone="danger" title="Your browser is not saving data">
      What you enter will be lost when you close this tab. Use a normal browser window so your details are kept.
    </Notice>
  ) : null;

  if (restoring) {
    return (
      <div className={styles.page}>
        {warning}
        <div>
          <Button variant="ghost" onClick={() => setRestoring(false)}>
            Back to setup
          </Button>
        </div>
        <BackupScreen
          store={store}
          restoreOnly
          onRestored={() => {
            afterRestore.current = true;
            setRestoring(false);
            setAttempt((count) => count + 1);
          }}
        />
      </div>
    );
  }

  const businessName = workspace?.name;
  const suggestedName = businessName && businessName !== DEFAULT_WORKSPACE_NAME ? businessName : '';
  const initial = profile ? profileToForm(profile) : { ...emptyProfileForm('unregistered'), gstUnconfirmed: true, name: suggestedName };
  const firstGap = profile ? missingForSetup(profile)[0] : undefined;
  const startStep: SetupStep | undefined = query.step ?? (firstGap ? stepOf(firstGap.path) : undefined);
  const label = query.next ? returnLabel(query.next) : null;
  const submitLabel = mode === 'setup' ? (label ? `Finish and open ${label}` : 'Finish setup') : label ? `Save and return to ${label}` : 'Save changes';

  return (
    <div className={styles.page}>
      {warning}
      {restoredIncomplete ? (
        <Notice tone="info" title="Backup restored">
          The backup did not have all of your business details. Fill in what is missing below to finish setup.
        </Notice>
      ) : null}
      <div className={styles.intro}>
        {mode === 'setup' ? (
          <>
            <p>
              {label && query.next && isToolPath(query.next) ? (
                <>
                  Before you open the <strong>{label}</strong>, tell SoloKit about your business.{' '}
                </>
              ) : null}
              You do this once: every tool reads these details, so none of them asks again. It takes about two minutes, and
              everything stays on this device.
              {query.next && isToolPath(query.next) ? null : ' When you finish, you will see the tools you can use.'}
            </p>
            {profile === null ? (
              <div>
                <Button variant="secondary" onClick={() => setRestoring(true)}>
                  Already use SoloKit? Restore a backup
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <p>
            {businessName ? (
              <>
                Changing the details of <strong>{businessName}</strong>.{' '}
              </>
            ) : null}
            Every tool uses them from now on. Documents you have already issued keep the details they were made with.
          </p>
        )}
      </div>
      <ProfileForm
        mode={mode}
        initial={initial}
        {...(startStep ? { startStep } : {})}
        submitLabel={submitLabel}
        brandThemeSlot={(draftBrand) => (profile ? <BrandThemeCard storage={storage} profile={profile} draftBrand={draftBrand} onChanged={setProfile} /> : null)}
        extraActions={
          mode === 'edit' ? (
            <a className={styles.cancel} href={destination}>
              {label ? `Back to ${label} without saving` : 'Cancel'}
            </a>
          ) : null
        }
        onSave={async (next) => {
          await saveBusiness(next, profile);
          navigate(destination);
        }}
      />
    </div>
  );
}
