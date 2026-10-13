'use client';

import { useId, useState } from 'react';
import { computeDemo } from './computeDemo';
import styles from './ReceiptDemo.module.css';

export function ReceiptDemo() {
  const [amount, setAmount] = useState('1,00,000');
  const [sameState, setSameState] = useState(true);
  const inputId = useId();
  const result = computeDemo(amount, sameState);

  return (
    <section className={styles.receipt} aria-label="Live GST example">
      <header className={styles.head}>
        <span className={styles.stamp}>Example</span>
        <span className={`num ${styles.title}`}>Tax invoice</span>
      </header>

      <label className={styles.label} htmlFor={inputId}>
        Amount before GST
      </label>
      <div className={styles.field}>
        <span className={`num ${styles.symbol}`} aria-hidden="true">
          ₹
        </span>
        <input
          id={inputId}
          className={`num ${styles.input}`}
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>

      <fieldset className={styles.supply}>
        <legend className="sr-only">Where is the buyer?</legend>
        <label className={styles.choice}>
          <input type="radio" name="supply" checked={sameState} onChange={() => setSameState(true)} />
          <span>Buyer in Maharashtra</span>
        </label>
        <label className={styles.choice}>
          <input type="radio" name="supply" checked={!sameState} onChange={() => setSameState(false)} />
          <span>Buyer in another state</span>
        </label>
      </fieldset>

      <div aria-live="polite">
        {result ? (
          <>
            <dl className={styles.rows}>
              <div className={styles.row}>
                <dt>Taxable value</dt>
                <dd className="num">{result.taxable}</dd>
              </div>
              {result.taxRows.map((row) => (
                <div className={styles.row} key={row.label}>
                  <dt>{row.label}</dt>
                  <dd className="num">{row.amount}</dd>
                </div>
              ))}
              <div className={`${styles.row} ${styles.total}`}>
                <dt>Total</dt>
                <dd className="num">{result.total}</dd>
              </div>
            </dl>
            <p className={styles.words}>{result.words}</p>
          </>
        ) : (
          <p className={styles.hint}>Enter an amount like 1,00,000</p>
        )}
      </div>
    </section>
  );
}
