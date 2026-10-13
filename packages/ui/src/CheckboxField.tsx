import { useId, type InputHTMLAttributes } from 'react';
import styles from './Form.module.css';

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'children'> {
  label: string;
  hint?: string | undefined;
}

export function CheckboxField({ label, hint, ...input }: CheckboxFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={styles.checkbox}>
      <input {...input} id={id} type="checkbox" {...(hint ? { 'aria-describedby': hintId } : {})} />
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
