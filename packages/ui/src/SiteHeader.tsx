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

export function SiteHeader({ links, cta }: SiteHeaderProps) {
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
        <Button href={cta.href} className={styles.cta}>
          {cta.label}
        </Button>
      </div>
    </header>
  );
}
