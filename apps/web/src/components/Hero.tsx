import { Button } from '@solokit/ui';
import { toolHref } from '@solokit/registry';
import { ReceiptDemo } from './ReceiptDemo';
import { TrustStrip } from './TrustStrip';
import styles from './Hero.module.css';

export function Hero() {
  return (
    <section className={`container ${styles.hero}`}>
      <div className={styles.grid}>
        <div>
          <p className={styles.eyebrow}>
            <span className={styles.dot} aria-hidden="true" />
            Free tools, built in India
          </p>
          <h1 className={styles.title}>
            Paperwork for <em>one-person</em> businesses.
          </h1>
          <p className={styles.lede}>
            Invoices, quotes and agreements that run in your browser. Free, no login, and nothing you type leaves your
            device.
          </p>
          <div className={styles.actions}>
            <Button href={toolHref('invoice')}>Create an invoice</Button>
            <Button href="/#tools" variant="secondary">
              See all tools
            </Button>
          </div>
          <TrustStrip />
        </div>
        <ReceiptDemo />
      </div>
    </section>
  );
}
