import { ReceiptDemo } from './ReceiptDemo';
import { ToolIcon } from './ToolIcon';
import styles from './AppFrame.module.css';

const NAV = ['Home', 'Invoices', 'Quotations', 'Agreements'] as const;
const TOOLS = [
  { slug: 'invoice', label: 'Invoices', soon: false },
  { slug: 'contract', label: 'Contracts', soon: false },
  { slug: 'rate-calculator', label: 'Rate calculator', soon: true },
  { slug: 'qr-code', label: 'QR codes', soon: true },
] as const;
const RECENT = [
  { id: 'INV-0023', client: 'Kite Labs', status: 'Paid', meta: '2 days ago' },
  { id: 'QUO-0011', client: 'Northwind', status: 'Sent', meta: 'Last week' },
  { id: 'INV-0022', client: 'Acme Studio', status: 'Paid', meta: '12 Oct' },
] as const;

/**
 * A mock of the app window (rico's product UI) around the real, live GST example. Everything but the example is
 * decoration and hidden from assistive tech; the sample names and figures are made up.
 */
export function AppFrame() {
  return (
    <div className={styles.stage}>
      <div className={styles.frame}>
        <aside className={styles.sidebar} aria-hidden="true">
          <div className={styles.workspace}>
            <span className={styles.wsLogo} />
            <span className={styles.wsName}>Your business</span>
            <span className={styles.caret}>⌄</span>
          </div>
          <div className={styles.quick}>
            <span>Quick actions</span>
            <kbd>⌘K</kbd>
          </div>
          <ul className={styles.nav}>
            {NAV.map((item) => (
              <li key={item} className={item === 'Invoices' ? styles.active : undefined}>
                {item}
              </li>
            ))}
          </ul>
          <p className={styles.label}>Tools</p>
          <ul className={styles.nav}>
            {TOOLS.map((tool) => (
              <li key={tool.slug}>
                <ToolIcon slug={tool.slug} size="sm" />
                {tool.label}
                {tool.soon ? <span className={styles.soon}>Soon</span> : null}
              </li>
            ))}
          </ul>
          <p className={styles.label}>Recent</p>
          <ul className={`${styles.nav} ${styles.recent}`}>
            <li>INV-0023 · Kite Labs</li>
            <li>Mutual NDA · Northwind</li>
          </ul>
          <div className={styles.progress}>
            <span className={styles.ring} />
            <span>
              Getting started
              <span className={styles.progressMeta}>2 of 5</span>
            </span>
          </div>
        </aside>

        <div className={styles.content}>
          <p className={styles.crumbs} aria-hidden="true">
            Invoices <span>/</span> New
          </p>
          <ReceiptDemo />
        </div>

        <aside className={styles.side} aria-hidden="true">
          <div className={styles.card}>
            <p className={styles.cardLabel}>Billed this quarter</p>
            <p className={styles.stat}>
              ₹4,86,200 <span className={styles.delta}>+12.4%</span>
            </p>
            <svg className={styles.chart} viewBox="0 0 200 64" preserveAspectRatio="none">
              <path className={styles.gridline} d="M0 16H200M0 32H200M0 48H200" />
              <path className={styles.area} d="M0 52 L25 46 L50 48 L75 36 L100 40 L125 28 L150 30 L175 16 L200 12 V64 H0Z" />
              <path className={styles.line} d="M0 52 L25 46 L50 48 L75 36 L100 40 L125 28 L150 30 L175 16 L200 12" />
            </svg>
          </div>
          <div className={styles.card}>
            <p className={styles.cardLabel}>Recent</p>
            <ul className={styles.rows}>
              {RECENT.map((row) => (
                <li key={row.id}>
                  <ToolIcon slug={row.id.startsWith('QUO') ? 'contract' : 'invoice'} size="sm" />
                  <span className={styles.rowId}>{row.id}</span>
                  <span className={styles.rowClient}>{row.client}</span>
                  <span className={row.status === 'Paid' ? styles.paid : styles.sent}>{row.status}</span>
                </li>
              ))}
            </ul>
            <p className={styles.saved}>Saved on this device</p>
          </div>
        </aside>
      </div>

      <div className={styles.floaters} aria-hidden="true">
        <span className={`${styles.float} ${styles.f1}`}>
          <span className={`${styles.avatar} ${styles.av1}`} />
          CGST + SGST split for you
        </span>
        <span className={`${styles.float} ${styles.f2}`}>
          <span className={`${styles.avatar} ${styles.av2}`} />
          Works offline
        </span>
        <span className={`${styles.cursor} ${styles.c1}`}>
          <svg viewBox="0 0 16 16">
            <path d="M2 1.5 13.5 7 8 8.5 6 14z" />
          </svg>
          <span className={styles.tag}>You</span>
        </span>
        <span className={`${styles.cursor} ${styles.c2}`}>
          <svg viewBox="0 0 16 16">
            <path d="M2 1.5 13.5 7 8 8.5 6 14z" />
          </svg>
          <span className={styles.tag}>This quarter</span>
        </span>
      </div>
    </div>
  );
}
