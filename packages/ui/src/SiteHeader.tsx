import type { ReactNode } from 'react';
import { Button } from './Button';
import { Logo } from './Logo';
import styles from './SiteHeader.module.css';

export interface NavLink {
  label: string;
  href: string;
}

export interface SiteHeaderProps {
  links: NavLink[];
  cta: NavLink;
}

export interface SiteHeaderSlots {
  /** Shown between the links and the call to action, for example the Business switcher. */
  extra?: ReactNode;
}

export function SiteHeader({ links, cta, extra }: SiteHeaderProps & SiteHeaderSlots) {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Logo />
        <nav aria-label="Primary" className={styles.nav}>
          <ul>
            {links.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        {extra ? <div className={styles.extra}>{extra}</div> : null}
        <Button href={cta.href} className={styles.cta}>
          {cta.label}
        </Button>
      </div>
    </header>
  );
}
