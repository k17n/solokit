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
        <path className={styles.paper} d="M5 2.5h14v17.2l-2.33-1.6-2.34 1.6L12 18.1l-2.33 1.6-2.34-1.6L5 19.7z" />
        <path className={styles.lines} d="M8.5 8.5h7M8.5 12h4.5" />
      </svg>
      <span className={styles.word}>
        {BRAND.first}
        <span className={styles.kit}>{BRAND.second}</span>
      </span>
    </a>
  );
}
