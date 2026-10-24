'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { getTools, type ToolDefinition } from '@solokit/registry';
import { Logo } from '@solokit/ui';
import { ToolIcon } from '../components/ToolIcon';
import { APP_HOME, BUSINESS_PATH, SETUP_PATH, toolAppHref } from '../paths';
import { BusinessSwitcher } from '../workspace/BusinessSwitcher';
import { useConfirmLeave } from '../workspace/unsavedGuard';
import { AppLink } from './AppLink';
import styles from './AppShell.module.css';

/** The id of the search box on the app home, which the sidebar's Search and Ctrl/⌘+K focus. */
export const APP_SEARCH_ID = 'app-search';

interface NavItem {
  label: string;
  href: string;
  /** Whether this item is the page shown, by its path. */
  current: (path: string) => boolean;
  tool?: ToolDefinition;
  /** An outline icon for items that are not tools. */
  glyph?: string;
}

/** Outline icons, on the same 16-unit grid as the tool icons. */
const GLYPHS = {
  home: 'M2.75 7.25 8 3l5.25 4.25M4.25 6.25v6.5h7.5v-6.5M6.75 12.75v-3.5h2.5v3.5',
  business: 'M3.25 13.25V4.75L8 2.75l4.75 2v8.5M2.25 13.25h11.5M6 6.5h1M9 6.5h1M6 9h1M9 9h1',
} as const;

function Glyph({ d }: { d: string }) {
  return (
    <svg className={styles.glyph} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

const withSlash = (path: string) => (path.endsWith('/') ? path : `${path}/`);

/** Home, every ready tool, and the Business's details (setup counts as part of them). */
export function appNav(): { home: NavItem; tools: NavItem[]; soon: ToolDefinition[]; business: NavItem } {
  const tools = getTools();
  return {
    home: { label: 'Home', href: APP_HOME, current: (path) => path === APP_HOME, glyph: GLYPHS.home },
    tools: tools
      .filter((tool) => tool.status === 'available')
      .map((tool) => {
        const href = toolAppHref(tool.slug);
        return { label: tool.navLabel ?? tool.name, href, current: (path: string) => path.startsWith(href), tool };
      }),
    soon: tools.filter((tool) => tool.status !== 'available'),
    business: { label: 'Your business', href: BUSINESS_PATH, current: (path) => path.startsWith(BUSINESS_PATH) || path.startsWith(SETUP_PATH), glyph: GLYPHS.business },
  };
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The frame around every page of the app (everything under /app/), like any SaaS app: a sidebar with the Business
 * switcher, search, the app's navigation and the tools coming soon, and the page beside it. The sidebar stays mounted
 * while people move around the app. On a phone it is a drawer behind a Menu button.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const path = withSlash(usePathname() ?? APP_HOME);
  const router = useRouter();
  const confirmLeave = useConfirmLeave();
  const [open, setOpen] = useState(false);
  const [shortcut, setShortcut] = useState('Ctrl K');
  const menuRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarId = useId();
  const nav = appNav();

  useEffect(() => {
    if (isMac()) setShortcut('⌘K');
  }, []);

  // A new page closes the drawer.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  const closeDrawer = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) menuRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    sidebarRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeDrawer]);

  /** Focuses the search on the app home, going there first when another page is shown. */
  const openSearch = useCallback(async () => {
    const box = document.getElementById(APP_SEARCH_ID);
    if (box) {
      setOpen(false);
      box.focus();
      return;
    }
    if (await confirmLeave('leave')) router.push(`${APP_HOME}#search`);
  }, [confirmLeave, router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        void openSearch();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openSearch]);

  const link = (item: NavItem) => (
    <AppLink href={item.href} className={styles.navLink} aria-current={item.current(path) ? 'page' : undefined}>
      {item.tool ? <ToolIcon slug={item.tool.slug} category={item.tool.category} size="sm" /> : item.glyph ? <Glyph d={item.glyph} /> : null}
      {item.label}
    </AppLink>
  );

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <button ref={menuRef} type="button" className={styles.menu} aria-expanded={open} aria-controls={sidebarId} onClick={() => setOpen((shown) => !shown)}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
            <path d="M2.5 4h11M2.5 8h11M2.5 12h11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Menu
        </button>
        <Logo href={APP_HOME} />
      </header>

      {open ? <div className={styles.backdrop} aria-hidden="true" onClick={() => closeDrawer(false)} /> : null}

      <aside ref={sidebarRef} id={sidebarId} className={styles.sidebar} data-open={open || undefined} aria-label="SoloKit app">
        <div className={styles.brand}>
          <Logo href={APP_HOME} />
        </div>
        <div className={styles.switcher}>
          <BusinessSwitcher placement="sidebar" />
        </div>
        <button type="button" className={styles.search} onClick={() => void openSearch()}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>Search tools</span>
          <kbd aria-hidden="true">{shortcut}</kbd>
        </button>

        <nav aria-label="App" className={styles.nav}>
          <ul className={styles.navList}>
            <li>{link(nav.home)}</li>
          </ul>
          <p className={styles.label}>Tools</p>
          <ul className={styles.navList}>
            {nav.tools.map((item) => (
              <li key={item.href}>{link(item)}</li>
            ))}
          </ul>
          <p className={styles.label}>Business</p>
          <ul className={styles.navList}>
            <li>{link(nav.business)}</li>
          </ul>
        </nav>

        {nav.soon.length > 0 ? (
          <div className={styles.soonGroup}>
            <p className={styles.label}>Coming soon</p>
            <ul className={styles.navList}>
              {nav.soon.map((tool) => (
                <li key={tool.slug} className={styles.soon}>
                  <ToolIcon slug={tool.slug} category={tool.category} size="sm" />
                  {tool.navLabel ?? tool.name.replace(/ (generator|calculator)$/, '')}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={styles.sideFoot}>
          <p className={styles.saved}>
            <span className={styles.dot} aria-hidden="true" />
            Saved on this device only
          </p>
          <nav aria-label="SoloKit site" className={styles.footLinks}>
            <a href="/">SoloKit website</a>
            <a href="/privacy/">Privacy</a>
          </nav>
        </div>
      </aside>

      <div className={styles.main}>{children}</div>
    </div>
  );
}
