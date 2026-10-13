import type { TextareaHTMLAttributes } from 'react';
import { Field } from './Field';
import styles from './Form.module.css';

export interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'children'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}

export function TextAreaField({ label, hint, error, className, rows = 3, ...textarea }: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => <textarea {...textarea} {...control} rows={rows} className={[styles.textarea, className].filter(Boolean).join(' ')} />}
    </Field>
  );
}
