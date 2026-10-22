'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { missingForSetup, type BusinessProfile } from '@solokit/profile';
import { TOOL_CATEGORY_LABELS, getTools } from '@solokit/registry';
import { KIND_LABELS, type Contract } from '@solokit/tool-contract';
import { KIND_LABEL, isBackupDue, type InvoiceRecord } from '@solokit/tool-invoice';
import { Badge, Button, Notice, formatIsoDate } from '@solokit/ui';
import { AppLink } from '../app-shell/AppLink';
import { APP_SEARCH_ID } from '../app-shell/AppShell';
import { deepLinkHref } from '../app-shell/deepLinks';
import { ToolIcon } from '../components/ToolIcon';
import { useContractStorage } from '../contract/useContractStorage';
import { BUSINESS_PATH, toolAppHref } from '../paths';
import { AFTER_FIRST_SETUP } from '../setup/links';
import { SetupRequired } from '../setup/SetupRequired';
import { quickActions, search, type SearchItem } from './search';
import styles from './AppHome.module.css';

/** A saved document for the Recent list. */
interface Recent {
  id: string;
  href: string;
  tool: 'invoice' | 'contract';
  title: string;
  meta: string;
  status: { label: string; tone?: 'success' | 'soon' };
  updatedAt: string;
}

interface Loaded {
  profile: BusinessProfile | null;
  invoices: InvoiceRecord[];
  contracts: Contract[];
  lastBackupAt: string | undefined;
}

const RECENT_COUNT = 5;

const INVOICE_STATUS: Record<InvoiceRecord['status'], Recent['status']> = {
  draft: { label: 'Draft' },
  issued: { label: 'Issued', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'soon' },
};

/** The latest invoices, quotations and agreements, newest first. */
function recentOf(invoices: InvoiceRecord[], contracts: Contract[]): Recent[] {
  const day = (iso: string) => formatIsoDate(iso.slice(0, 10));
  const fromInvoices = invoices.map<Recent>((invoice) => ({
    id: invoice.id,
    href: deepLinkHref('invoice', { doc: invoice.id }),
    tool: 'invoice',
    title: `${KIND_LABEL[invoice.kind ?? 'invoice']} ${invoice.number}`,
    meta: [invoice.client.name, day(invoice.updatedAt)].filter(Boolean).join(' · '),
    status: INVOICE_STATUS[invoice.status],
    updatedAt: invoice.updatedAt,
  }));
  const fromContracts = contracts.map<Recent>((contract) => ({
    id: contract.id,
    href: deepLinkHref('contract', { doc: contract.id }),
    tool: 'contract',
    title: contract.title.trim() || KIND_LABELS[contract.kind],
    meta: day(contract.updatedAt),
    status: contract.status === 'final' ? { label: 'Final', tone: 'success' } : { label: 'Draft' },
    updatedAt: contract.updatedAt,
  }));
  return [...fromInvoices, ...fromContracts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, RECENT_COUNT);
}

function greetingFor(date: Date): string {
  const hour = date.getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

/** Typing in a field must never be taken for the "/" shortcut. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** One search result, an action or a tool. Tools that are coming are shown, but go nowhere yet. */
function ResultRow({ item }: { item: SearchItem }) {
  const body = (
    <>
      <ToolIcon slug={item.tool.slug} category={item.tool.category} size="sm" />
      <span className={styles.resultText}>
        <span className={styles.resultLabel}>{item.label}</span>
        <span className={styles.resultDescription}>{item.description}</span>
      </span>
      <span className={styles.resultKind}>{item.kind === 'action' ? 'Start' : item.kind === 'tool' ? 'Open tool' : 'Coming soon'}</span>
    </>
  );
  return item.href ? (
    <AppLink href={item.href} className={styles.result}>
      {body}
    </AppLink>
  ) : (
    <div className={`${styles.result} ${styles.resultSoon}`}>{body}</div>
  );
}

/**
 * The app home, where "Get started" lands and setup ends: a greeting, a search for tools and actions, one-click starts
 * for new documents, the latest documents and the tools. A Business that is not set up yet is sent to setup first,
 * which brings it back here.
 */
export function AppHome({ now = () => new Date() }: { now?: () => Date } = {}) {
  const { contracts, invoice, ready, persistent } = useContractStorage();
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [welcome] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('welcome') === '1');
  const searchRef = useRef<HTMLInputElement>(null);
  const welcomeRef = useRef<HTMLDivElement>(null);
  const hintId = useId();

  useEffect(() => {
    if (!invoice || !contracts) return;
    let cancelled = false;
    setFailed(false);
    Promise.all([invoice.profile.get(), invoice.invoices.list(), contracts.list(), invoice.settings.get()]).then(
      ([profile, invoices, agreements, settings]) => {
        if (!cancelled) setLoaded({ profile: profile ?? null, invoices, contracts: agreements, lastBackupAt: settings.lastBackupAt });
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

  const shown = loaded !== undefined;
  // Focus: the welcome after setup, or the search when the sidebar's Search (or Ctrl/⌘+K) brought the person here.
  useEffect(() => {
    if (!shown) return;
    if (welcome) welcomeRef.current?.focus();
    else if (window.location.hash === '#search') searchRef.current?.focus();
  }, [shown, welcome]);

  // "/" anywhere on the page jumps to the search, as on many apps.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !isTyping(event.target)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => search(query), [query]);
  const actions = useMemo(() => quickActions(), []);

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
  if (!ready || !loaded) return <p>Opening SoloKit…</p>;

  const { profile, invoices, contracts: agreements, lastBackupAt } = loaded;
  if (profile === null || missingForSetup(profile).length > 0) return <SetupRequired returnTo={AFTER_FIRST_SETUP} />;

  const today = now();
  const recent = recentOf(invoices, agreements);
  const tools = getTools();
  const readyTools = tools.filter((tool) => tool.status === 'available');
  const soon = tools.filter((tool) => tool.status !== 'available');
  const counts: Record<string, number> = { invoice: invoices.length, contract: agreements.length };
  const searching = query.trim() !== '';

  function onSearchKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setQuery('');
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const first = results.find((item) => item.href);
      if (first?.href) router.push(first.href);
    }
  }

  return (
    <div className={styles.page}>
      {!persistent ? (
        <Notice tone="danger" title="Your browser is not saving data">
          What you enter will be lost when you close this tab. Use a normal browser window so your work is kept.
        </Notice>
      ) : null}

      <header className={styles.hero}>
        <p className={styles.date}>{today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className={styles.greeting}>
          {greetingFor(today)}, <span className={styles.name}>{profile.name}</span>
        </h1>
        <p className={styles.sub}>What would you like to do today?</p>
        <form role="search" className={styles.searchForm} onSubmit={(event) => event.preventDefault()}>
          <label htmlFor={APP_SEARCH_ID} className="sr-only">
            Search tools and actions
          </label>
          <svg className={styles.searchIcon} viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" focusable="false">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            id={APP_SEARCH_ID}
            type="search"
            className={styles.searchInput}
            placeholder="Search: invoice, quotation, NDA…"
            autoComplete="off"
            aria-describedby={hintId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKey}
          />
          <kbd className={styles.searchKey} aria-hidden="true">
            /
          </kbd>
        </form>
        <p id={hintId} className="sr-only">
          Results show below as you type. Enter opens the first one.
        </p>
      </header>

      {welcome ? (
        <div ref={welcomeRef} tabIndex={-1} className={styles.welcome}>
          <Notice tone="info" title={`${profile.name} is set up`}>
            Your details are saved on this device, and every tool fills itself in from them. Start with one of the actions below.
          </Notice>
        </div>
      ) : null}

      <p className="sr-only" role="status" aria-live="polite">
        {searching ? (results.length === 0 ? 'No results' : `${results.length} ${results.length === 1 ? 'result' : 'results'}`) : ''}
      </p>

      {searching ? (
        <section aria-labelledby="results-heading" className={styles.group}>
          <h2 id="results-heading" className={styles.heading}>
            Results for “{query.trim()}”
          </h2>
          {results.length > 0 ? (
            <ul role="list" className={styles.results}>
              {results.map((item) => (
                <li key={item.id}>
                  <ResultRow item={item} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>Nothing matches. Try “invoice”, “quotation” or “NDA”.</p>
          )}
        </section>
      ) : (
        <>
          {isBackupDue(lastBackupAt, today, invoices.length + agreements.length > 0) ? (
            <Notice tone="warning" title="Back up your work">
              {lastBackupAt ? `Your last backup was on ${formatIsoDate(lastBackupAt.slice(0, 10))}.` : 'You have not made a backup yet.'} Everything is
              stored only in this browser, so a backup file is your safety net. <AppLink href={`${BUSINESS_PATH}#backup`}>Download a backup</AppLink>
            </Notice>
          ) : null}

          <section aria-labelledby="actions-heading" className={styles.group}>
            <h2 id="actions-heading" className={styles.heading}>
              Quick actions
            </h2>
            <ul role="list" className={styles.actions}>
              {actions.map((action) => (
                <li key={action.id}>
                  <AppLink href={action.href ?? toolAppHref(action.tool.slug)} className={styles.action}>
                    <ToolIcon slug={action.tool.slug} category={action.tool.category} size="sm" />
                    <span className={styles.actionText}>
                      <span className={styles.actionLabel}>{action.label}</span>
                      <span className={styles.actionDescription}>{action.description}</span>
                    </span>
                  </AppLink>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="recent-heading" className={styles.group}>
            <h2 id="recent-heading" className={styles.heading}>
              Recent
            </h2>
            {recent.length > 0 ? (
              <ul role="list" className={styles.recent}>
                {recent.map((item) => (
                  <li key={`${item.tool}-${item.id}`}>
                    <AppLink href={item.href} className={styles.recentRow}>
                      <ToolIcon slug={item.tool} size="sm" />
                      <span className={styles.recentTitle}>{item.title}</span>
                      <span className={styles.recentMeta}>{item.meta}</span>
                      <Badge {...(item.status.tone ? { tone: item.status.tone } : {})}>{item.status.label}</Badge>
                    </AppLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>Nothing yet. The invoices, quotations and agreements you make show up here.</p>
            )}
          </section>

          <section aria-labelledby="tools-heading" className={styles.group}>
            <h2 id="tools-heading" className={styles.heading}>
              Your tools
            </h2>
            <ul role="list" className={styles.grid}>
              {readyTools.map((tool) => {
                const count = counts[tool.slug] ?? 0;
                return (
                  <li key={tool.slug}>
                    <AppLink className={styles.card} href={toolAppHref(tool.slug)}>
                      <span className={styles.cardTop}>
                        <ToolIcon slug={tool.slug} category={tool.category} />
                        <span className={styles.category}>{TOOL_CATEGORY_LABELS[tool.category]}</span>
                      </span>
                      <span className={styles.cardName}>{tool.name}</span>
                      <span className={styles.tagline}>{tool.tagline}</span>
                      <span className={styles.count}>{count === 0 ? 'Nothing saved yet' : `${count} saved`}</span>
                    </AppLink>
                  </li>
                );
              })}
            </ul>
            {soon.length > 0 ? (
              <p className={styles.soonLine}>
                <span>Coming soon:</span> {soon.map((tool) => tool.name).join(', ')}
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
