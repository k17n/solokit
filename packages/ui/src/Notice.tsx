import type { ReactNode } from 'react';
import styles from './Form.module.css';

export interface NoticeProps {
  tone?: 'info' | 'warning' | 'danger';
  title?: string;
  children: ReactNode;
}

export function Notice({ tone = 'info', title, children }: NoticeProps) {
  return (
    <div className={styles.notice} data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      {title ? <p className={styles.noticeTitle}>{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}
