import styles from './LocalSection.module.css';

function UploadVisual() {
  return (
    <div className={`${styles.visual} ${styles.showcase}`} aria-hidden="true">
      <span className={styles.globe} />
      <span className={styles.chip}>
        <span className={styles.chipDot} />0 bytes uploaded
      </span>
    </div>
  );
}

function OfflineVisual() {
  return (
    <div className={`${styles.visual} ${styles.product}`} aria-hidden="true">
      <div className={styles.panel}>
        <div className={styles.setting}>
          <span>Network</span>
          <span className={styles.pillMuted}>Offline</span>
        </div>
        <div className={styles.setting}>
          <span>Invoice editor</span>
          <span className={styles.pillOk}>Ready</span>
        </div>
        <div className={styles.setting}>
          <span>Contract generator</span>
          <span className={styles.pillOk}>Ready</span>
        </div>
      </div>
    </div>
  );
}

function BackupVisual() {
  return (
    <div className={`${styles.visual} ${styles.product}`} aria-hidden="true">
      <div className={styles.panel}>
        <div className={styles.file}>
          <span className={styles.fileIcon} />
          <span className={styles.fileText}>
            <span className={styles.fileName}>solokit-backup.json</span>
            <span className={styles.fileMeta}>48 KB · just now</span>
          </span>
          <span className={styles.fileBtn}>Download</span>
        </div>
        <div className={styles.restore}>Restore on another device</div>
      </div>
    </div>
  );
}

const POINTS = [
  {
    title: 'Nothing is uploaded',
    body: 'Everything you enter is saved in your browser. We never see your clients or your numbers.',
    visual: UploadVisual,
  },
  {
    title: 'Works without internet',
    body: 'Install it once and it opens on a train, on a flight or on bad Wi-Fi.',
    visual: OfflineVisual,
  },
  {
    title: 'Back up when you like',
    body: 'Export everything as one file and restore it on another device.',
    visual: BackupVisual,
  },
] as const;

export function LocalSection() {
  return (
    <section id="local" aria-labelledby="local-heading" className={`container ${styles.section}`}>
      <p className={styles.eyebrow}>Local-first</p>
      <h2 id="local-heading" className={styles.heading}>
        Built to stay out of your way
      </h2>
      <div className={styles.grid}>
        {POINTS.map(({ title, body, visual: Visual }) => (
          <div key={title} className={styles.point}>
            <Visual />
            <div className={styles.text}>
              <h3 className={styles.title}>{title}</h3>
              <p className={styles.body}>{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
