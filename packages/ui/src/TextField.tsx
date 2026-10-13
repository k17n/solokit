import type { InputHTMLAttributes } from 'react';
import { Field } from './Field';
import styles from './Form.module.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'children' | 'required'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
}

export function TextField({ label, hint, error, required, className, ...input }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(control) => (
        <input
          {...input}
          {...control}
          {...(required ? { 'aria-required': true as const } : {})}
          className={[styles.input, className].filter(Boolean).join(' ')}
        />
      )}
    </Field>
  );
}
