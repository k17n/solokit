import { useId, type InputHTMLAttributes } from 'react';
import styles from './Form.module.css';

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'children' | 'required'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
}

export function CheckboxField({ label, hint, error, 'aria-describedby': callerDescribedBy, ...input }: CheckboxFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [callerDescribedBy, hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  return (
    <div className={styles.checkbox}>
      <input {...input} id={id} type="checkbox" {...(describedBy ? { 'aria-describedby': describedBy } : {})} />
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
