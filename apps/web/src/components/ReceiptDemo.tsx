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
        <p className={styles.title}>Tax invoice</p>
        <span className={styles.status}>Example</span>
      </header>
      <p className={styles.desc}>One line at 18% GST. Change the amount or where the buyer is.</p>

      <div className={styles.form}>
        <div className={styles.amount}>
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
        </div>

        <fieldset className={styles.supply}>
          <legend className={styles.label}>Where is the buyer?</legend>
          <div className={styles.segmented}>
            <label className={styles.choice}>
              <input type="radio" name="supply" checked={sameState} onChange={() => setSameState(true)} />
              <span>Buyer in Maharashtra</span>
            </label>
            <label className={styles.choice}>
              <input type="radio" name="supply" checked={!sameState} onChange={() => setSameState(false)} />
              <span>Buyer in another state</span>
            </label>
          </div>
        </fieldset>
      </div>

      <div aria-live="polite" className={styles.result}>
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
