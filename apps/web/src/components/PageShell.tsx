import type { ReactNode } from 'react';
import styles from './PageShell.module.css';

export interface PageShellProps {
  eyebrow?: string;
  title: string;
  lede?: string;
  children: ReactNode;
}

export function PageShell({ eyebrow, title, lede, children }: PageShellProps) {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <header className={styles.head}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        {lede ? <p className={styles.lede}>{lede}</p> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </main>
  );
}
