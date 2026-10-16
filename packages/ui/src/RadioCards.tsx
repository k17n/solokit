import { useId } from 'react';
import styles from './Form.module.css';

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
  /** A short marker beside the label, for example "Template default". */
  tag?: string;
}

export interface RadioCardsProps {
  legend: string;
  name: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: RadioCardOption[];
  error?: string | undefined;
  /** Help shown under the legend and read with each choice. */
  hint?: string | undefined;
}

/** A group of large, described radio buttons. Uses native radios, so the keyboard works as expected. */
export function RadioCards({ legend, name, value, onChange, options, error, hint }: RadioCardsProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  return (
    <fieldset className={styles.cards} {...(describedBy ? { 'aria-describedby': describedBy } : {})}>
      <legend className={styles.legend}>{legend}</legend>
      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {options.map((option) => (
        <label key={option.value} className={styles.card}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            {...(error ? { 'aria-invalid': true as const } : {})}
          />
          <span className={styles.cardLabel}>
            {option.label}
            {option.tag ? <span className={styles.tag}>{option.tag}</span> : null}
          </span>
          {option.description ? <span className={styles.cardDescription}>{option.description}</span> : null}
        </label>
      ))}
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
