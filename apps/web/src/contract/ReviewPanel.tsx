'use client';

import type { ReviewSummary } from '@solokit/tool-contract';
import { Notice } from '@solokit/ui';
import styles from './ReviewPanel.module.css';

const Rows = ({ rows }: { rows: { label: string; value: string; note?: string | undefined }[] }) => (
  <dl className={styles.rows}>
    {rows.map((row, index) => (
      <div key={`${row.label}-${index}`} className={styles.row}>
        <dt>{row.label}</dt>
        <dd>
          {row.value}
          {row.note ? <span className={styles.note}> {row.note}</span> : null}
        </dd>
      </div>
    ))}
  </dl>
);

/** The Review summary: the choices made, the defaults left alone, and questions to take to a lawyer. */
export function ReviewPanel({ summary }: { summary: ReviewSummary }) {
  return (
    <div className={styles.panel}>
      <Notice tone="warning" title="Template, not legal advice">
        {summary.notice}
      </Notice>

      <section className={styles.card} aria-labelledby="review-choices">
        <h4 id="review-choices">Your key choices</h4>
        <Rows
          rows={[
            ...summary.parties.map((party) => ({ label: party.role, value: party.name })),
            { label: 'Effective date', value: summary.effectiveDate },
            { label: 'Courts or arbitration seat', value: summary.jurisdiction },
            ...summary.choices.map((choice) => ({
              label: choice.label,
              value: choice.value,
              note: choice.clauseNumber ? `(clause ${choice.clauseNumber})` : undefined,
            })),
          ]}
        />
        {summary.keyDates.length > 1 ? (
          <>
            <p className={styles.topic}>Key dates</p>
            <Rows rows={summary.keyDates.map((date) => ({ label: date.label, value: date.value, note: date.note }))} />
          </>
        ) : null}
      </section>

      <section className={styles.card} aria-labelledby="review-defaults">
        <h4 id="review-defaults">Defaults you did not change</h4>
        <p className={styles.lead}>These still have the value the template starts with. Look at them first: they are the settings you may not have thought about.</p>
        {summary.defaultsUnchanged.length === 0 ? (
          <p>Every setting was chosen by you.</p>
        ) : (
          <Rows rows={summary.defaultsUnchanged.map((choice) => ({ label: choice.label, value: choice.value, note: choice.clauseNumber ? `(clause ${choice.clauseNumber})` : undefined }))} />
        )}
      </section>

      <section className={styles.card} aria-labelledby="review-questions">
        <h4 id="review-questions">Questions for your lawyer</h4>
        <p className={styles.lead}>Suggestions to start the conversation, not a complete list.</p>
        <ol className={styles.list}>
          {summary.questions.map((question, index) => (
            <li key={index}>
              <span className={styles.topic}>{question.topic}</span>
              {question.clauseNumber ? <span className={styles.ref}> (clause {question.clauseNumber})</span> : null}
              {`. ${question.text}`}
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.card} aria-labelledby="review-stamp">
        <h4 id="review-stamp">Stamp duty</h4>
        <p>{summary.stampDuty.text}</p>
      </section>

      <details className={styles.card}>
        <summary>Clause by clause, in plain English</summary>
        {summary.clauses.map((clause) => (
          <div key={clause.number} className={styles.clause}>
            <p className={styles.topic}>
              {clause.number}. {clause.title}
            </p>
            <p>
              <strong>What this means: </strong>
              {clause.explanation}
            </p>
            <p>
              <strong>Why it is here: </strong>
              {clause.rationale}
            </p>
            <p className={styles.note}>{clause.risk}</p>
          </div>
        ))}
      </details>

      <details className={styles.card}>
        <summary>Assumptions this document makes</summary>
        <ul className={styles.list}>
          {summary.assumptions.map((assumption, index) => (
            <li key={index}>{assumption}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
