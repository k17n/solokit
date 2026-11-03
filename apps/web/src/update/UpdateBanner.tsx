'use client';

import styles from './UpdateBanner.module.css';

/** Tells the person a newer SoloKit is ready. Reloading keeps everything saved on this device. */
export function UpdateBanner({ onReload, onLater }: { onReload: () => void; onLater: () => void }) {
  return (
    <div className={styles.banner} role="status">
      <p className={styles.text}>
        <strong>A new version of SoloKit is ready.</strong> Reload to use it. Your saved documents stay on this device.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onReload}>
          Reload
        </button>
        <button type="button" className={styles.later} onClick={onLater}>
          Later
        </button>
      </div>
    </div>
  );
}
