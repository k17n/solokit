'use client';

import { useId } from 'react';
import {
  BILLING_UNITS,
  BILLING_UNIT_LABELS,
  COMMON_SERVICE_CODES,
  SUPPORTED_CURRENCIES,
  formatAmount,
  type CurrencyCode,
  type SellerProfile,
} from '@solokit/tool-invoice';
import {
  CURRENT_GST_SLABS,
  GST_SLAB_REFORM_DATE,
  LEGACY_GST_SLABS,
  SPECIAL_GST_RATES,
  isLegacyRateForDate,
} from '@solokit/tax-engines';
import { Button, Notice, SelectField, TextField, formatIsoDate } from '@solokit/ui';
import { emptyLine, previewLineAmount, type DiscountKind, type LineDraft } from './editorModel';
import { newId } from './ids';
import styles from './LineItemsEditor.module.css';

export interface LineItemsEditorProps {
  lines: LineDraft[];
  onChange: (lines: LineDraft[]) => void;
  taxApplies: boolean;
  currency: CurrencyCode;
  issueDate: string;
  profile: SellerProfile;
  /** Messages keyed like `lines[0].rate`. */
  errors: Record<string, string>;
}

const DISCOUNT_OPTIONS: { value: DiscountKind; label: string }[] = [
  { value: 'none', label: 'No discount' },
  { value: 'percent', label: 'Percent (%)' },
  { value: 'amount', label: 'Amount' },
];

function gstRateOptions(line: LineDraft, issueDate: string): { value: string; label: string }[] {
  const options = [...CURRENT_GST_SLABS, ...SPECIAL_GST_RATES].map((rate) => ({ value: String(rate), label: `${rate}%` }));
  const beforeChange = issueDate < GST_SLAB_REFORM_DATE;
  for (const rate of LEGACY_GST_SLABS) {
    if (beforeChange || line.gstRate === String(rate)) options.push({ value: String(rate), label: `${rate}% (old rate)` });
  }
  return options;
}

export function LineItemsEditor({ lines, onChange, taxApplies, currency, issueDate, profile, errors }: LineItemsEditorProps) {
  const listId = useId();
  const symbol = SUPPORTED_CURRENCIES.find((candidate) => candidate.code === currency)?.symbol ?? currency;

  const update = (index: number, patch: Partial<LineDraft>) =>
    onChange(lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));

  return (
    <div className={styles.list}>
      <datalist id={listId}>
        {COMMON_SERVICE_CODES.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.description}
          </option>
        ))}
      </datalist>

      {lines.map((line, index) => {
        const at = `lines[${index}]`;
        const amount = previewLineAmount(line);
        const rate = Number(line.gstRate);
        const oldRateWarning = taxApplies && line.gstRate !== '' && isLegacyRateForDate(rate, issueDate);
        return (
          <fieldset key={line.id} className={styles.item}>
            <legend className={styles.legend}>{`Item ${index + 1}`}</legend>
            <TextField
              label="Description"
              value={line.description}
              onChange={(event) => update(index, { description: event.target.value })}
              error={errors[`${at}.description`]}
            />
            <div className={styles.grid}>
              <TextField
                label="HSN/SAC code"
                hint="Suggestions come from a short list of common codes. It is not an official register: type any code you need."
                list={listId}
                autoComplete="off"
                value={line.code}
                onChange={(event) => update(index, { code: event.target.value })}
              />
              <TextField
                label="Quantity"
                inputMode="decimal"
                autoComplete="off"
                value={line.quantity}
                onChange={(event) => update(index, { quantity: event.target.value })}
                error={errors[`${at}.quantity`]}
              />
              <SelectField
                label="Unit"
                options={BILLING_UNITS.map((unit) => ({ value: unit, label: BILLING_UNIT_LABELS[unit] }))}
                value={line.unit}
                onChange={(event) => update(index, { unit: event.target.value as LineDraft['unit'] })}
              />
              <TextField
                label={`Rate (${symbol})`}
                inputMode="decimal"
                autoComplete="off"
                value={line.rate}
                onChange={(event) => update(index, { rate: event.target.value })}
                error={errors[`${at}.rate`]}
              />
              <SelectField
                label="Discount"
                options={DISCOUNT_OPTIONS}
                value={line.discountKind}
                onChange={(event) => update(index, { discountKind: event.target.value as DiscountKind, discountValue: '' })}
              />
              {line.discountKind !== 'none' ? (
                <TextField
                  label="Discount value"
                  inputMode="decimal"
                  autoComplete="off"
                  hint={line.discountKind === 'percent' ? 'A percentage from 0 to 100' : `An amount in ${symbol}`}
                  value={line.discountValue}
                  onChange={(event) => update(index, { discountValue: event.target.value })}
                  error={errors[`${at}.discount`]}
                />
              ) : null}
              {taxApplies ? (
                <SelectField
                  label="GST rate"
                  options={gstRateOptions(line, issueDate)}
                  value={line.gstRate}
                  onChange={(event) => update(index, { gstRate: event.target.value })}
                  error={errors[`${at}.gstRate`]}
                />
              ) : null}
            </div>
            {oldRateWarning ? (
              <Notice tone="warning">
                {`${rate}% was withdrawn on ${formatIsoDate(GST_SLAB_REFORM_DATE)}. Check the rate for an invoice dated ${formatIsoDate(issueDate)}.`}
              </Notice>
            ) : null}
            <div className={styles.footer}>
              <p className={styles.amount}>
                {amount === null ? 'Amount before GST: not worked out yet' : `Amount before GST: ${formatAmount(amount, currency)}`}
              </p>
              <Button variant="secondary" disabled={lines.length === 1} onClick={() => onChange(lines.filter((_, position) => position !== index))}>
                Remove item
              </Button>
            </div>
          </fieldset>
        );
      })}

      <div>
        <Button variant="secondary" onClick={() => onChange([...lines, emptyLine(newId(), profile)])}>
          Add item
        </Button>
      </div>
    </div>
  );
}
