'use client';

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { missingForSetup, type BusinessProfile } from '@solokit/profile';
import { getStateByCode } from '@solokit/tax-engines';
import { Button, Notice } from '@solokit/ui';
import { ProSlot } from '../platform/ProSlot';
import { useShowUpsell } from '../platform/PlatformProvider';
import { useInvoiceStorage } from '../invoice/useInvoiceStorage';
import { WorkspaceStore, useWorkspaces } from '../workspace/WorkspaceProvider';
import { AddBusiness } from './AddBusiness';
import { BackupScreen } from './BackupScreen';
import { ManageBusinesses } from './ManageBusinesses';
import { GST_STATUS_OPTIONS, STEP_INFO } from './ProfileForm';
import { SETUP_STEPS, setupHref, type SetupStep } from '../setup/links';
import { navigate } from '../setup/navigate';
import { BUSINESS_PATH } from '../paths';
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

  // A new, empty Business goes straight to setup; one restored from a backup already has its details.
  if (hash === 'add') return <AddBusiness onCreated={() => navigate(setupHref(BUSINESS_PATH))} onRestored={leaveAdd} onCancel={leaveAdd} />;

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
      <PlansSection />
    </div>
  );
}

/** Hidden unless the site config turns upsell on. Says only that paid plans are not available yet; a plugin may fill the slot. */
function PlansSection() {
  const showUpsell = useShowUpsell();
  if (!showUpsell) return null;
  return (
    <section id="plans" className={styles.anchor} aria-labelledby="plans-heading">
      <h2 id="plans-heading" className={styles.heading}>
        Plans
      </h2>
      <ProSlot name="business.plans" />
    </section>
  );
}

function CurrentBusiness({ now }: BusinessPageProps) {
  const { storage, store, ready, persistent } = useInvoiceStorage();
  const { current } = useWorkspaces();
  const detailsId = useId();
  const [profile, setProfile] = useState<BusinessProfile | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!storage) return;
    let cancelled = false;
    setLoadFailed(false);
    storage.profile.get().then(
      (found) => {
        if (!cancelled) setProfile(found ?? null);
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

  if (loadFailed) {
    return (
      <Notice tone="danger" title="Your saved details could not be opened">
        Your browser could not read what was saved on this device. Reload the page. If it keeps happening, your data may be damaged.
      </Notice>
    );
  }
  if (!ready || !storage || !store || !current || profile === undefined) return <p>Opening your business…</p>;

  const complete = profile !== null && missingForSetup(profile).length === 0;

  return (
    <>
      {!persistent ? (
        <Notice tone="danger" title="Your browser is not saving data">
          What you enter will be lost when you close this tab. Use a normal browser window so your work is kept, or download a backup below before you leave.
        </Notice>
      ) : null}

      <section id="details" className={styles.section} aria-labelledby={`${detailsId}-title`}>
        <div className={styles.detailsHead}>
          <div>
            <h2 id={`${detailsId}-title`} tabIndex={-1} className={styles.heading}>
              {complete ? 'This business' : `Set up ${current.name}`}
            </h2>
            <p className={styles.lede}>
              {complete ? (
                <>
                  You are working in <strong>{current.name}</strong>. Every tool reads these details from here.
                </>
              ) : (
                <>
                  Tell SoloKit about <strong>{current.name}</strong> once, and every tool fills itself in from it. It takes about two minutes.
                </>
              )}
            </p>
          </div>
          {complete ? (
            <Button variant="secondary" href={setupHref(BUSINESS_PATH)}>
              Edit details
            </Button>
          ) : null}
        </div>
        {complete ? (
          <ProfileSummary profile={profile} />
        ) : (
          <div>
            <Button href={setupHref(BUSINESS_PATH)}>{profile ? 'Finish setup' : 'Set up this business'}</Button>
          </div>
        )}
      </section>

      <section id="backup" className={styles.section}>
        <BackupScreen store={store} onRestored={() => setAttempt((count) => count + 1)} {...(now ? { now } : {})} />
      </section>
    </>
  );
}

const joined = (...parts: (string | undefined)[]) => parts.map((part) => part?.trim()).filter(Boolean).join(', ');

/** The last four digits only, so the page can be shown on a shared screen. */
const masked = (account: string) => `ending ${account.trim().slice(-4)}`;

/** What each setup step holds, in a line or two, for the summary. */
function summaryOf(profile: BusinessProfile, step: SetupStep): ReactNode {
  switch (step) {
    case 'tax': {
      const status = GST_STATUS_OPTIONS.find((option) => option.value === profile.gstStatus)?.label ?? 'Not chosen';
      return profile.gstin ? `${status} · GSTIN ${profile.gstin}` : status;
    }
    case 'details': {
      const state = profile.address.stateCode ? getStateByCode(profile.address.stateCode)?.name : undefined;
      return (
        <>
          <strong>{profile.name}</strong>
          <br />
          {joined(profile.address.line1, profile.address.line2, profile.address.city, profile.address.postalCode, state)}
          <br />
          {joined(profile.email, profile.phone)}
        </>
      );
    }
    case 'brand': {
      const colours = Object.values(profile.brand ?? {}).filter(Boolean) as string[];
      if (!profile.logoDataUrl && colours.length === 0) return 'Not added';
      return (
        <span className={styles.brandLine}>
          {profile.logoDataUrl ? 'Logo added' : 'No logo'}
          {colours.map((colour) => (
            <span key={colour} className={styles.swatch} style={{ background: colour }} title={colour} />
          ))}
        </span>
      );
    }
    case 'payments': {
      const bank = profile.bank?.accountNumber ? `${profile.bank.bankName || 'Bank'} account ${masked(profile.bank.accountNumber)}` : undefined;
      const upi = profile.upiId ? `UPI ${profile.upiId}` : undefined;
      return joined(bank, upi) || 'Not added';
    }
    case 'defaults':
      return profile.invoicePrefix ? `Invoice numbers start with ${profile.invoicePrefix}` : 'Standard numbering';
    default:
      return null;
  }
}

/** The saved details at a glance, each with a link that opens that step of setup and comes back here. */
function ProfileSummary({ profile }: { profile: BusinessProfile }) {
  return (
    <dl className={styles.summary}>
      {SETUP_STEPS.map((step) => (
        <div key={step} className={styles.summaryRow}>
          <dt>{STEP_INFO[step].title}</dt>
          <dd>{summaryOf(profile, step)}</dd>
          <dd className={styles.summaryAction}>
            <a href={setupHref(BUSINESS_PATH, step)} aria-label={`Change ${STEP_INFO[step].title.toLowerCase()}`}>
              Change
            </a>
          </dd>
        </div>
      ))}
    </dl>
  );
}
