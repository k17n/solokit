'use client';

import { useEffect, useState } from 'react';
import { Notice } from '@solokit/ui';
import { AppLink } from '../app-shell/AppLink';
import { requestPersistentStorage } from '../invoice/persist';
import { BUSINESS_PATH } from '../paths';
import styles from './StorageNotice.module.css';

const DISMISSED_KEY = 'solokit-storage-notice-dismissed';

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Asks the browser to keep this site's data safe from automatic clean-up. If the browser declines, says so and points
 * to the backup, because then the data is only as safe as the browser's own housekeeping. Says nothing when the browser
 * grants it, does not support the request, or the person has dismissed the notice.
 */
export function StorageNotice() {
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (!storage?.persist) return;
    void (async () => {
      let kept = false;
      try {
        kept = Boolean(await storage.persisted?.()) || (await requestPersistentStorage());
      } catch {
        kept = false;
      }
      if (!cancelled && !kept && !wasDismissed()) setDeclined(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!declined) return null;
  return (
    <div className={styles.wrap}>
      <Notice tone="warning" title="Your browser may clear saved data">
        Your browser has not promised to keep what SoloKit saves on this device. Download a backup now and then so nothing
        is lost. <AppLink href={`${BUSINESS_PATH}#backup`}>Go to backup</AppLink>
        <button
          type="button"
          className={styles.dismiss}
          onClick={() => {
            try {
              window.localStorage.setItem(DISMISSED_KEY, '1');
            } catch {
              // Not remembering the dismissal only means seeing the notice again next visit.
            }
            setDeclined(false);
          }}
        >
          Dismiss
        </button>
      </Notice>
    </div>
  );
}
