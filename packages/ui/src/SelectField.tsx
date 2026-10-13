import type { ReactNode, SelectHTMLAttributes } from 'react';
import { Field } from './Field';
import styles from './Form.module.css';

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children' | 'required'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  options: SelectOption[];
  placeholder?: string;
}

type Entry = { kind: 'option'; option: SelectOption } | { kind: 'group'; label: string; options: SelectOption[] };

/** Ungrouped options stay where they are; options sharing a `group` are collected into one optgroup at its first appearance. */
function renderOptions(options: SelectOption[]): ReactNode[] {
  const entries: Entry[] = [];
  const groups = new Map<string, Extract<Entry, { kind: 'group' }>>();
  for (const option of options) {
    if (option.group === undefined) {
      entries.push({ kind: 'option', option });
      continue;
    }
    let group = groups.get(option.group);
    if (!group) {
      group = { kind: 'group', label: option.group, options: [] };
      groups.set(option.group, group);
      entries.push(group);
    }
    group.options.push(option);
  }
  return entries.map((entry) =>
    entry.kind === 'option' ? (
      <option key={`o-${entry.option.value}`} value={entry.option.value}>
        {entry.option.label}
      </option>
    ) : (
      <optgroup key={`g-${entry.label}`} label={entry.label}>
        {entry.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </optgroup>
    ),
  );
}

export function SelectField({ label, hint, error, required, options, placeholder, className, ...select }: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(control) => (
        <select
          {...select}
          {...control}
          {...(required ? { 'aria-required': true as const } : {})}
          className={[styles.select, className].filter(Boolean).join(' ')}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {renderOptions(options)}
        </select>
      )}
    </Field>
  );
}
