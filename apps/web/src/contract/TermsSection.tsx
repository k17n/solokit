'use client';

import { useState } from 'react';
import { parseMoney } from '@solokit/core';
import { LIBRARY, fillPartyTerms, formatRupees, partyTerms, type Contract, type Milestone, type OptionDef, type VariableDef, variableDefault } from '@solokit/tool-contract';
import { Button, RadioCards, TextAreaField, TextField } from '@solokit/ui';
import { newId } from '../invoice/ids';
import { emptyMilestone, fieldGroups, type FieldGroup, fieldHint, fieldLabel, isNumeric, parseVariableText, setOption, setVariable, textOf } from './editorModel';
import styles from './sections.module.css';

export interface TermsSectionProps {
  contract: Contract;
  /** What the user typed into each numeric field, which may not be a number yet. */
  typed: Record<string, string>;
  /** Messages keyed like `variables.termMonths`. */
  errors: Record<string, string>;
  onChange: (next: Contract) => void;
  onTyped: (id: string, text: string) => void;
}

function OptionField({ def, contract, error, onPick }: { def: OptionDef; contract: Contract; error: string | undefined; onPick: (choice: string) => void }) {
  const terms = partyTerms(contract.kind);
  const fill = (text: string) => fillPartyTerms(text, terms.a, terms.b);
  const chosen = contract.options[def.id] ?? def.default;
  return (
    <RadioCards
      legend={def.label}
      hint={def.help}
      name={`option-${def.id}`}
      value={chosen}
      error={error}
      onChange={onPick}
      options={def.choices
        .filter((choice) => choice.kinds === undefined || choice.kinds.includes(contract.kind))
        .map((choice) => ({
          value: choice.id,
          label: fill(choice.label),
          description: fill(choice.summary),
          ...(choice.id === def.default ? { tag: 'Template default' } : {}),
        }))}
    />
  );
}

function VariableField({
  def,
  contract,
  typed,
  error,
  onValue,
  onTyped,
}: {
  def: VariableDef;
  contract: Contract;
  typed: string | undefined;
  error: string | undefined;
  onValue: (value: string | number | undefined) => void;
  onTyped: (text: string) => void;
}) {
  const label = fieldLabel(def);
  const hint = fieldHint(def, contract);
  const required = def.required !== false;
  if (def.type === 'longtext') {
    return (
      <TextAreaField
        label={label}
        hint={def.example ? `${hint} For example: ${def.example.replace(/\n/g, '; ')}.` : hint}
        required={required}
        rows={def.id === 'purpose' ? 3 : 5}
        value={textOf(contract.variables[def.id])}
        onChange={(event) => onValue(event.target.value.trim() === '' ? undefined : event.target.value)}
        error={error}
      />
    );
  }
  if (def.type === 'text') {
    return (
      <TextField
        label={label}
        hint={def.example ? `${hint} For example: ${def.example}.` : hint}
        required={required}
        autoComplete="off"
        value={textOf(contract.variables[def.id])}
        onChange={(event) => onValue(event.target.value.trim() === '' ? undefined : event.target.value)}
        error={error}
      />
    );
  }
  if (def.type === 'date') {
    return <TextField label={label} hint={hint} required={required} type="date" value={textOf(contract.variables[def.id])} onChange={(event) => onValue(event.target.value === '' ? undefined : event.target.value)} error={error} />;
  }
  // Numbers: keep exactly what was typed, so "12." or "1,50" does not jump around while typing.
  const shown = typed ?? textOf(contract.variables[def.id]);
  return (
    <TextField
      label={label}
      hint={hint}
      required={required}
      inputMode={def.type === 'integer' ? 'numeric' : 'decimal'}
      autoComplete="off"
      value={shown}
      onChange={(event) => {
        const text = event.target.value;
        onTyped(text);
        const parsed = parseVariableText(def, text);
        onValue(parsed.ok ? parsed.value : undefined);
      }}
      error={error}
    />
  );
}

function MilestonesEditor({ milestones, errors, onChange }: { milestones: Milestone[]; errors: Record<string, string>; onChange: (next: Milestone[]) => void }) {
  // What was typed for each amount, since "12." is not yet a number.
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(milestones.map((milestone) => [milestone.id, milestone.amount > 0 ? String(milestone.amount) : ''])),
  );
  const patch = (id: string, change: Partial<Milestone>) => onChange(milestones.map((milestone) => (milestone.id === id ? { ...milestone, ...change } : milestone)));
  const total = milestones.reduce((sum, milestone) => sum + Math.round(milestone.amount * 100), 0) / 100;
  return (
    <div className={styles.group}>
      <p className={styles.sub} style={{ margin: 0 }}>
        Split the fee into steps. Each milestone is a payment the client makes when something is done.
      </p>
      {errors['milestones'] ? (
        <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontWeight: 600 }} tabIndex={-1} data-problem="milestones">
          {errors['milestones']}
        </p>
      ) : null}
      {milestones.map((milestone, index) => (
        <fieldset key={milestone.id} className={`${styles.group} ${styles.milestone}`}>
          <legend className={styles.legend}>Milestone {index + 1}</legend>
          <TextField label="Milestone name" required autoComplete="off" value={milestone.title} onChange={(event) => patch(milestone.id, { title: event.target.value })} error={errors[`milestones.${index}.title`]} />
          <div className={styles.row}>
            <TextField
              label="Amount (INR)"
              required
              inputMode="decimal"
              autoComplete="off"
              value={amounts[milestone.id] ?? ''}
              onChange={(event) => {
                const text = event.target.value;
                setAmounts((current) => ({ ...current, [milestone.id]: text }));
                const minor = parseMoney(text);
                patch(milestone.id, { amount: minor === null || minor < 0 ? 0 : minor / 100 });
              }}
              error={errors[`milestones.${index}.amount`]}
            />
            <TextField
              label="Due when"
              hint="A date or a trigger, for example: on delivery of the first draft."
              required
              autoComplete="off"
              value={milestone.due}
              onChange={(event) => patch(milestone.id, { due: event.target.value })}
              error={errors[`milestones.${index}.due`]}
            />
          </div>
          <div>
            <Button variant="ghost" aria-label={`Remove milestone ${index + 1}`} onClick={() => onChange(milestones.filter((candidate) => candidate.id !== milestone.id))}>
              Remove milestone
            </Button>
          </div>
        </fieldset>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
        <Button variant="secondary" onClick={() => onChange([...milestones, emptyMilestone(newId())])}>
          Add a milestone
        </Button>
        {milestones.length > 0 ? <span className={styles.muted}>Total of the milestones: {formatRupees(total)}</span> : null}
      </div>
    </div>
  );
}

export function TermsSection({ contract, typed, errors, onChange, onTyped }: TermsSectionProps) {
  const groups = fieldGroups(contract);
  const feeModel = contract.options['feeModel'] ?? LIBRARY.options.find((def) => def.id === 'feeModel')?.default;
  // A group needs attention when something in it has no template default to fall back on; the rest are tucked away.
  const needsInput = (group: FieldGroup) => group.clauseId === 'fees' || group.variables.some((def) => def.required !== false && variableDefault(def, contract) === undefined) || group.options.some((def) => def.default === undefined);
  const hasError = (group: FieldGroup) => group.options.some((def) => errors[`options.${def.id}`]) || group.variables.some((def) => errors[`variables.${def.id}`]) || (group.clauseId === 'fees' && Object.keys(errors).some((key) => key.startsWith('milestones')));
  const essential = groups.filter(needsInput);
  const optional = groups.filter((group) => !essential.includes(group));
  const renderGroup = (group: FieldGroup) => (
    <fieldset key={group.clauseId} className={styles.group}>
      <legend className={styles.legend}>{group.title}</legend>
      {group.options.map((def) => (
        <OptionField key={def.id} def={def} contract={contract} error={errors[`options.${def.id}`]} onPick={(choice) => onChange(setOption(contract, def.id, choice))} />
      ))}
      {group.variables.map((def) => (
        <VariableField
          key={def.id}
          def={def}
          contract={contract}
          typed={isNumeric(def) ? typed[def.id] : undefined}
          error={errors[`variables.${def.id}`]}
          onValue={(value) => onChange(setVariable(contract, def.id, value))}
          onTyped={(text) => onTyped(def.id, text)}
        />
      ))}
      {group.clauseId === 'fees' && contract.kind === 'services' && feeModel === 'milestones' ? (
        <MilestonesEditor milestones={contract.milestones} errors={errors} onChange={(milestones) => onChange({ ...contract, milestones })} />
      ) : null}
    </fieldset>
  );
  return (
    <div className={styles.group}>
      <TextField
        label="Effective date"
        hint="The date the agreement starts. Often the day you both sign."
        required
        type="date"
        value={contract.effectiveDate}
        onChange={(event) => onChange({ ...contract, effectiveDate: event.target.value })}
        error={errors['effectiveDate']}
      />
      {essential.map(renderGroup)}
      {optional.length > 0 ? (
        <details className={styles.disclosure} open={optional.some(hasError) || undefined}>
          <summary>Other settings ({optional.length} topics). They start at the template's defaults; open this to look at or change them.</summary>
          <div className={styles.group} style={{ marginTop: '0.5rem' }}>
            {optional.map(renderGroup)}
          </div>
        </details>
      ) : null}
    </div>
  );
}
