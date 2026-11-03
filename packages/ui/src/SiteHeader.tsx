import type { ReactNode } from 'react';
import { Button } from './Button';
import { Logo } from './Logo';
import styles from './SiteHeader.module.css';

export interface NavLink {
  label: string;
  href: string;
  /** Opens in a new tab, for links that leave the site. */
  external?: boolean;
}

/** Props for an anchor that leaves the site: a new tab that cannot reach back into this one. */
export function externalProps(link: NavLink) {
  return link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}

export interface SiteHeaderProps {
  links: NavLink[];
  cta: NavLink;
  /** A link to the project's GitHub repository, shown as a star prompt. */
  github?: NavLink;
}

export interface SiteHeaderSlots {
  /** Shown between the links and the call to action, for example the Business switcher. */
  extra?: ReactNode;
}

export function SiteHeader({ links, cta, github, extra }: SiteHeaderProps & SiteHeaderSlots) {
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
        {github ? (
          <a className={styles.github} href={github.href} {...externalProps({ ...github, external: true })}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
              <path
                fill="currentColor"
                d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.1 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"
              />
            </svg>
            {github.label}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
        {extra ? <div className={styles.extra}>{extra}</div> : null}
        <Button href={cta.href} className={styles.cta}>
          {cta.label}
        </Button>
      </div>
    </header>
  );
}
