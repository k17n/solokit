import { BRAND } from './brand';
import styles from './Logo.module.css';

export interface LogoProps {
  href?: string;
  size?: 'md' | 'lg';
}

export function Logo({ href = '/', size = 'md' }: LogoProps) {
  return (
    <a href={href} className={`${styles.logo} ${styles[size] ?? ''}`} aria-label={`${BRAND.name} home`}>
      <svg className={styles.mark} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect className={styles.tile} width="24" height="24" rx="6" />
        <path className={styles.paper} d="M7.5 5.5h9v12.6l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z" />
        <path className={styles.lines} d="M9.75 9.25h4.5M9.75 12h2.75" />
      </svg>
      <span className={styles.word}>
        {BRAND.first}
        <span className={styles.kit}>{BRAND.second}</span>
      </span>
    </a>
  );
}
