'use client';

import { useEffect, useRef, useState } from 'react';
import { Notice } from '@solokit/ui';
import { requestPersistentStorage } from './persist';
import { useInvoiceStorage } from './useInvoiceStorage';
import styles from './InvoiceApp.module.css';

type ViewName = 'list' | 'profile';

const TABS: { name: ViewName; label: string }[] = [
  { name: 'list', label: 'Invoices' },
  { name: 'profile', label: 'Profile' },
];

export function InvoiceApp() {
  const { ready, persistent } = useInvoiceStorage();
  const [view, setView] = useState<ViewName>('list');
  const asked = useRef(false);

  useEffect(() => {
    if (ready && persistent && !asked.current) {
      asked.current = true;
      void requestPersistentStorage();
    }
  }, [ready, persistent]);

  if (!ready) return <p>Opening your invoices…</p>;

  return (
    <div className={styles.app}>
      {!persistent ? (
        <Notice tone="danger" title="Your browser is not saving data">
          What you enter will be lost when you close this tab. Use a normal browser window, or download a backup before you leave.
        </Notice>
      ) : null}
      <nav aria-label="Invoice tool">
        <div className={styles.tabs} role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.name}
              type="button"
              role="tab"
              aria-selected={view === tab.name}
              className={styles.tab}
              onClick={() => setView(tab.name)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
      <div className={styles.panel}>
        {view === 'list' ? <p className={styles.empty}>Your invoices will appear here.</p> : <p className={styles.empty}>Your business profile will go here.</p>}
      </div>
    </div>
  );
}
