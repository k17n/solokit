'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { getAvailableTools } from '@solokit/registry';
import { Logo } from '@solokit/ui';
import { APP_HOME, BUSINESS_PATH, SETUP_PATH, toolAppHref } from '../paths';
import { BusinessSwitcher } from '../workspace/BusinessSwitcher';
import { AppLink } from './AppLink';
import styles from './AppShell.module.css';

interface NavItem {
  label: string;
  href: string;
  /** Whether this item is the page shown, by its path. */
  current: (path: string) => boolean;
}

const withSlash = (path: string) => (path.endsWith('/') ? path : `${path}/`);

/** Home, every ready tool, and the Business's details (setup counts as part of them). */
export function appNav(): NavItem[] {
  return [
    { label: 'Home', href: APP_HOME, current: (path) => path === APP_HOME },
    ...getAvailableTools().map((tool) => {
      const href = toolAppHref(tool.slug);
      return { label: tool.navLabel ?? tool.name, href, current: (path: string) => path.startsWith(href) };
    }),
    { label: 'Your business', href: BUSINESS_PATH, current: (path) => path.startsWith(BUSINESS_PATH) || path.startsWith(SETUP_PATH) },
  ];
}

/**
 * The frame around every page of the app (everything under /app/): a compact bar with the app's navigation and the
 * Business switcher, and a slim footer. It stays mounted while people move between pages of the app.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const path = withSlash(usePathname() ?? APP_HOME);
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <div className={`container ${styles.barInner}`}>
          <Logo href={APP_HOME} />
          <nav aria-label="App" className={styles.nav}>
            <ul className={styles.navList}>
              {appNav().map((item) => (
                <li key={item.href}>
                  <AppLink href={item.href} className={styles.navLink} aria-current={item.current(path) ? 'page' : undefined}>
                    {item.label}
                  </AppLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.switcher}>
            <BusinessSwitcher />
          </div>
        </div>
      </header>
      <div className={styles.content}>{children}</div>
      <footer className={styles.footer}>
        <div className={`container ${styles.footerInner}`}>
          <p>Everything here is saved on this device only.</p>
          <nav aria-label="SoloKit site" className={styles.footerLinks}>
            <a href="/">SoloKit website</a>
            <a href="/privacy/">Privacy</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
