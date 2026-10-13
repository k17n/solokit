import styles from './Form.module.css';

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
}

export interface RadioCardsProps {
  legend: string;
  name: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: RadioCardOption[];
  error?: string | undefined;
}

/** A group of large, described radio buttons. Uses native radios, so the keyboard works as expected. */
export function RadioCards({ legend, name, value, onChange, options, error }: RadioCardsProps) {
  return (
    <fieldset className={styles.cards}>
      <legend className={styles.legend}>{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className={styles.card}>
          <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
          <span className={styles.cardLabel}>{option.label}</span>
          {option.description ? <span className={styles.cardDescription}>{option.description}</span> : null}
        </label>
      ))}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
