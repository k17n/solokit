import styles from './TrustStrip.module.css';

const POINTS = ['Free', 'No signup', 'Works offline', 'Data stays on your device'] as const;

export function TrustStrip() {
  return (
    <ul role="list" className={styles.strip} aria-label="Why people trust it">
      {POINTS.map((point) => (
        <li key={point} className={styles.item}>
          <svg className={styles.tick} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M4 8.5l2.5 2.5L12 5.5" />
          </svg>
          {point}
        </li>
      ))}
    </ul>
  );
}
