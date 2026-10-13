import type { TextareaHTMLAttributes } from 'react';
import { Field } from './Field';
import styles from './Form.module.css';

export interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'children' | 'required'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
}

export function TextAreaField({ label, hint, error, required, className, rows = 3, ...textarea }: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(control) => (
        <textarea
          {...textarea}
          {...control}
          {...(required ? { 'aria-required': true as const } : {})}
          rows={rows}
          className={[styles.textarea, className].filter(Boolean).join(' ')}
        />
      )}
    </Field>
  );
}
