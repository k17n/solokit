'use client';

import { clauseTitle, type Contract } from '@solokit/tool-contract';
import { CheckboxField } from '@solokit/ui';
import { Disclosure } from './Disclosure';
import { isIncluded, optionalClauses, requiredClauses, setClauseIncluded } from './editorModel';
import styles from './sections.module.css';

export function ClausesSection({ contract, errors, onChange }: { contract: Contract; errors: Record<string, string>; onChange: (next: Contract) => void }) {
  const optional = optionalClauses(contract.kind);
  const required = requiredClauses(contract.kind);
  return (
    <div className={styles.group}>
      <p className={styles.sub} style={{ margin: 0 }}>
        These clauses are the template&apos;s judgement calls. Switch each one on or off. Open &quot;Why this is here&quot; to see what it does and when to ask a lawyer.
      </p>
      {optional.map((clause) => {
        const on = isIncluded(contract, clause);
        const title = clauseTitle(clause, contract.kind);
        return (
          <div key={clause.id} className={styles.clause} data-on={on}>
            <CheckboxField
              label={title}
              hint={clause.explanation}
              checked={on}
              onChange={(event) => onChange(setClauseIncluded(contract, clause, event.target.checked))}
              error={errors[`clauseOverrides.${clause.id}`]}
              {...(errors[`clauseOverrides.${clause.id}`] ? { 'aria-invalid': true } : {})}
            />
            <Disclosure
              className={styles.why}
              summary={
                <>
                  Why this is here<span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>: {title}</span>
                </>
              }
            >
              <p>{clause.rationale}</p>
              <p className={styles.muted}>{clause.risk}</p>
              <p className={styles.muted}>The template {(clause.defaultIncluded ?? true) ? 'includes' : 'leaves out'} this clause unless you change it.</p>
            </Disclosure>
          </div>
        );
      })}
      <Disclosure className={styles.disclosure} summary={`Clauses that are always included (${required.length})`}>
        <ul className={styles.plain}>
          {required.map((clause) => (
            <li key={clause.id}>{clauseTitle(clause, contract.kind)}</li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}
