import styles from './TrustStrip.module.css';

const POINTS = ['Free', 'No signup', 'Works offline', 'Data stays on your device'] as const;

export function TrustStrip() {
  return (
    <ul role="list" className={styles.strip} aria-label="Why people trust it">
      {POINTS.map((point) => (
        <li key={point} className={styles.stamp}>
          {point}
        </li>
      ))}
    </ul>
  );
}
