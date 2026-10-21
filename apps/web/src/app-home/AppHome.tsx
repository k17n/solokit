'use client';

import { useEffect, useRef, useState } from 'react';
import { missingForSetup, type BusinessProfile } from '@solokit/profile';
import { TOOL_CATEGORY_LABELS, getTools } from '@solokit/registry';
import { isBackupDue } from '@solokit/tool-invoice';
import { Button, Notice, formatIsoDate } from '@solokit/ui';
import { AppLink } from '../app-shell/AppLink';
import { GST_STATUS_OPTIONS } from '../business/ProfileForm';
import { ToolIcon } from '../components/ToolIcon';
import { useContractStorage } from '../contract/useContractStorage';
import { APP_HOME, BUSINESS_PATH, toolAppHref } from '../paths';
import { AFTER_FIRST_SETUP, setupHref } from '../setup/links';
import { SetupRequired } from '../setup/SetupRequired';
import styles from './AppHome.module.css';

/** What is saved in each ready tool, for the line under its name. */
interface Counts {
  documents: number;
  agreements: number;
}

interface Loaded {
  profile: BusinessProfile | null;
  counts: Counts;
  lastBackupAt: string | undefined;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The line under a ready tool: what is in it, or what to do first. */
function toolStatus(slug: string, counts: Counts): string | null {
  if (slug === 'invoice') return counts.documents > 0 ? plural(counts.documents, 'invoice or quotation', 'invoices and quotations') : 'Make your first invoice or quotation';
  if (slug === 'contract') return counts.agreements > 0 ? plural(counts.agreements, 'agreement', 'agreements') : 'Make your first NDA or services agreement';
  return null;
}

/**
 * Where "Get started" lands, and where setup goes when it is done: the tools this Business can use, with what is in
 * each. A Business that is not set up yet is sent to setup first, which brings it back here.
 */
export function AppHome({ now = () => new Date() }: { now?: () => Date } = {}) {
  const { contracts, invoice, ready, persistent } = useContractStorage();
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [welcome] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('welcome') === '1');
  const welcomeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!invoice || !contracts) return;
    let cancelled = false;
    setFailed(false);
    Promise.all([invoice.profile.get(), invoice.invoices.list(), contracts.list(), invoice.settings.get()]).then(
      ([profile, documents, agreements, settings]) => {
        if (!cancelled) setLoaded({ profile: profile ?? null, counts: { documents: documents.length, agreements: agreements.length }, lastBackupAt: settings.lastBackupAt });
      },
      (error: unknown) => {
        console.error('Could not read this business', error);
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [invoice, contracts, attempt]);

  useEffect(() => {
    if (welcome && loaded) welcomeRef.current?.focus();
  }, [welcome, loaded]);

  if (failed) {
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
  if (!ready || !loaded) return <p>Opening your tools…</p>;

  const { profile, counts, lastBackupAt } = loaded;
  if (profile === null || missingForSetup(profile).length > 0) return <SetupRequired returnTo={AFTER_FIRST_SETUP} />;

  const tools = getTools();
  const readyTools = tools.filter((tool) => tool.status === 'available');
  const soon = tools.filter((tool) => tool.status !== 'available');
  const status = GST_STATUS_OPTIONS.find((option) => option.value === profile.gstStatus)?.label;
  const hasData = counts.documents + counts.agreements > 0;

  return (
    <div className={styles.page}>
      {!persistent ? (
        <Notice tone="danger" title="Your browser is not saving data">
          What you enter will be lost when you close this tab. Use a normal browser window so your work is kept.
        </Notice>
      ) : null}

      {welcome ? (
        <div ref={welcomeRef} tabIndex={-1} className={styles.welcome}>
          <Notice tone="info" title={`${profile.name} is set up`}>
            Your details are saved on this device, and every tool below fills itself in from them. Pick one to start.
          </Notice>
        </div>
      ) : null}

      <section className={styles.business} aria-label="This business">
        <div className={styles.businessText}>
          <p className={styles.businessName}>{profile.name}</p>
          <p className={styles.businessMeta}>
            {[status, profile.gstin, profile.address.city].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className={styles.businessActions}>
          <AppLink href={setupHref(APP_HOME)}>Edit business details</AppLink>
          <AppLink href={BUSINESS_PATH}>Backups and other businesses</AppLink>
        </div>
      </section>

      {isBackupDue(lastBackupAt, now(), hasData) ? (
        <Notice tone="warning" title="Back up your work">
          {lastBackupAt ? `Your last backup was on ${formatIsoDate(lastBackupAt.slice(0, 10))}.` : 'You have not made a backup yet.'} Everything is stored only in
          this browser, so a backup file is your safety net. <a href={`${BUSINESS_PATH}#backup`}>Download a backup</a>
        </Notice>
      ) : null}

      <section aria-labelledby="ready-heading" className={styles.group}>
        <h2 id="ready-heading" className={styles.heading}>
          Ready to use
        </h2>
        <ul role="list" className={styles.grid}>
          {readyTools.map((tool) => (
            <li key={tool.slug}>
              <AppLink className={styles.card} href={toolAppHref(tool.slug)}>
                <span className={styles.cardTop}>
                  <ToolIcon slug={tool.slug} category={tool.category} />
                  <span className={styles.category}>{TOOL_CATEGORY_LABELS[tool.category]}</span>
                </span>
                <span className={styles.name}>{tool.name}</span>
                <span className={styles.tagline}>{tool.tagline}</span>
                <span className={styles.status}>{toolStatus(tool.slug, counts)}</span>
                <span className={styles.open} aria-hidden="true">
                  Open <span className={styles.arrow}>→</span>
                </span>
              </AppLink>
            </li>
          ))}
        </ul>
      </section>

      {soon.length > 0 ? (
        <section aria-labelledby="soon-heading" className={styles.group}>
          <h2 id="soon-heading" className={styles.heading}>
            Coming soon
          </h2>
          <ul role="list" className={styles.soonList}>
            {soon.map((tool) => (
              <li key={tool.slug} className={styles.soon}>
                <ToolIcon slug={tool.slug} category={tool.category} size="sm" />
                <span>
                  <span className={styles.soonName}>{tool.name}</span>
                  <span className={styles.soonTagline}>{tool.tagline}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
