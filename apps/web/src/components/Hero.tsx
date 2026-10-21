import { APP_HOME } from '../setup/links';
import { AppFrame } from './AppFrame';
import { TrustStrip } from './TrustStrip';
import styles from './Hero.module.css';

export function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.backdrop} aria-hidden="true">
        <span className={`${styles.blob} ${styles.b1}`} />
        <span className={`${styles.blob} ${styles.b2}`} />
        <span className={`${styles.blob} ${styles.b3}`} />
        <span className={`${styles.blob} ${styles.b4}`} />
        <span className={styles.grid} />
      </div>

      <div className={`container ${styles.intro}`}>
        <p className={styles.chip}>
          <span className={styles.dot} aria-hidden="true" />
          Free tools, built in India
        </p>
        <h1 className={styles.title}>
          Paperwork for <span className={styles.fade}>
            <span className={styles.nowrap}>one-person</span> businesses.
          </span>
        </h1>
        <p className={styles.lede}>
          Invoices, quotes and agreements that run in your browser. Free, no login, and nothing you type leaves your
          device.
        </p>
        <div className={styles.actions}>
          {/* The app home sends a new visitor through the one-time business setup first, then lists the tools. */}
          <a className={`${styles.pill} ${styles.solid}`} href={APP_HOME}>
            Get started
          </a>
          <a className={`${styles.pill} ${styles.outline}`} href="/#tools">
            See all tools
          </a>
        </div>
        <TrustStrip />
      </div>

      <div className={`container ${styles.stage}`}>
        <AppFrame />
      </div>
    </section>
  );
}
