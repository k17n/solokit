import styles from './LocalSection.module.css';

const POINTS = [
  {
    title: 'Nothing is uploaded',
    body: 'Everything you enter is saved in your browser. We never see your clients or your numbers.',
  },
  {
    title: 'Works without internet',
    body: 'Install it once and it opens on a train, on a flight or on bad Wi-Fi.',
  },
  {
    title: 'Back up when you like',
    body: 'Export everything as one file and restore it on another device.',
  },
] as const;

export function LocalSection() {
  return (
    <section aria-labelledby="local-heading" className={`container ${styles.section}`}>
      <h2 id="local-heading" className={styles.heading}>
        Built to stay out of your way
      </h2>
      <div className={styles.grid}>
        {POINTS.map((point) => (
          <div key={point.title} className={styles.point}>
            <h3 className={styles.title}>{point.title}</h3>
            <p className={styles.body}>{point.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
