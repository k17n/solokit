'use client';

import { SUPPORTED_CURRENCIES, type InvoiceTheme } from '@solokit/tool-invoice';
import { type BusinessProfile } from '@solokit/profile';
import { CheckboxField, Notice, SelectField, TextAreaField, TextField } from '@solokit/ui';
import { taxApplies, type EditorState } from './editorModel';
import { selectableStates } from './profileFormState';

export interface DetailsSectionProps {
  state: EditorState;
  onChange: (patch: Partial<EditorState>) => void;
  profile: BusinessProfile;
  themes: InvoiceTheme[];
  /** Messages keyed like `issueDate`. */
  errors: Record<string, string>;
  /** Said under the number, for example when it was replaced after the type changed. */
  numberHint?: string | undefined;
}

const groupStyle = { display: 'grid', gap: '1rem', minWidth: 0, margin: 0, padding: 0, border: 0 } as const;
const legendStyle = { padding: 0, marginBottom: '0.25rem', fontFamily: 'var(--ff-display)', fontSize: '1.25rem', fontWeight: 700 } as const;
const rowStyle = { display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', alignItems: 'start' } as const;

const NUMBER_LABEL: Record<EditorState['kind'], string> = { invoice: 'Invoice number', proforma: 'Proforma number', quote: 'Quotation number' };
const DETAILS_LEGEND: Record<EditorState['kind'], string> = { invoice: 'Invoice details', proforma: 'Proforma invoice details', quote: 'Quotation details' };

export function DetailsSection({ state, onChange, profile, themes, errors, numberHint }: DetailsSectionProps) {
  const taxed = taxApplies(state, profile);
  const regular = profile.gstStatus === 'regular';
  const quote = state.kind === 'quote';

  return (
    <div style={{ display: 'grid', gap: '1.75rem' }}>
      <fieldset style={groupStyle}>
        <legend style={legendStyle}>{DETAILS_LEGEND[state.kind]}</legend>
        <div style={rowStyle}>
          <TextField
            label={NUMBER_LABEL[state.kind]}
            autoComplete="off"
            value={state.number}
            onChange={(event) => onChange({ number: event.target.value, numberEdited: true })}
            error={errors['number']}
            hint={numberHint}
          />
          <TextField label="Issue date" type="date" value={state.issueDate} onChange={(event) => onChange({ issueDate: event.target.value })} error={errors['issueDate']} />
          {quote ? (
            <TextField label="Valid until" type="date" value={state.validUntil} onChange={(event) => onChange({ validUntil: event.target.value })} error={errors['validUntil']} />
          ) : (
            <TextField label="Due date" type="date" value={state.dueDate} onChange={(event) => onChange({ dueDate: event.target.value })} error={errors['dueDate']} />
          )}
        </div>
      </fieldset>

      <fieldset style={groupStyle}>
        <legend style={legendStyle}>Supply</legend>
        <CheckboxField
          label="Client is outside India (export)"
          hint={
            regular
              ? 'If you have a Letter of Undertaking (LUT), exports of services are zero-rated; otherwise IGST applies - check with your CA.'
              : 'Bill your client in their own currency.'
          }
          checked={state.isExport}
          onChange={(event) =>
            onChange({
              isExport: event.target.checked,
              ...(event.target.checked
                ? {
                    reverseCharge: false,
                    ...(state.client.country.trim().toLowerCase() === 'india' ? { client: { ...state.client, country: '' } } : {}),
                  }
                : { client: { ...state.client, country: 'India' } }),
            })
          }
        />
        {state.isExport && regular && !profile.lutNumber?.trim() ? (
          <Notice tone="warning">
            Your profile has no LUT number. The invoice will say it is supplied under a Letter of Undertaking without naming one. Add the number in the Profile tab, or check with your CA whether IGST applies.
          </Notice>
        ) : null}
        {state.isExport ? (
          <SelectField
            label="Currency"
            options={SUPPORTED_CURRENCIES.map((currency) => ({ value: currency.code, label: `${currency.code} - ${currency.name}` }))}
            value={state.currency}
            onChange={(event) => onChange({ currency: event.target.value as EditorState['currency'] })}
          />
        ) : null}
        {taxed ? (
          <SelectField
            label="Place of supply"
            required
            placeholder="Choose a state"
            hint="For services this is usually where your client is."
            options={selectableStates()}
            value={state.placeOfSupplyStateCode}
            onChange={(event) => onChange({ placeOfSupplyStateCode: event.target.value, placeEdited: true })}
            error={errors['placeOfSupplyStateCode']}
          />
        ) : null}
        {taxed && !quote ? (
          <CheckboxField
            label="Reverse charge applies"
            hint="The buyer pays the GST instead of you."
            checked={state.reverseCharge}
            onChange={(event) => onChange({ reverseCharge: event.target.checked })}
          />
        ) : null}
        {regular && !state.isExport ? (
          <CheckboxField
            label="Exempt supply (bill of supply)"
            hint="No GST is charged on this supply."
            checked={state.exemptSupply}
            onChange={(event) => onChange({ exemptSupply: event.target.checked, ...(event.target.checked ? { reverseCharge: false } : {}) })}
          />
        ) : null}
      </fieldset>

      {quote ? null : (
      <fieldset style={groupStyle}>
        <legend style={legendStyle}>Payment</legend>
        <CheckboxField label="Client deducts TDS" checked={state.tdsEnabled} onChange={(event) => onChange({ tdsEnabled: event.target.checked })} />
        {state.tdsEnabled ? (
          <TextField
            label="TDS rate (%)"
            hint="Usually 10% for professional fees. Applied to the amount before GST."
            inputMode="decimal"
            autoComplete="off"
            value={state.tdsPercent}
            onChange={(event) => onChange({ tdsPercent: event.target.value })}
            error={errors['tds.ratePercent']}
          />
        ) : null}
        <TextField
          label="Advance already received"
          hint="Subtracted from the amount to pay."
          inputMode="decimal"
          autoComplete="off"
          value={state.advance}
          onChange={(event) => onChange({ advance: event.target.value })}
          error={errors['advanceReceived']}
        />
      </fieldset>
      )}

      <fieldset style={groupStyle}>
        <legend style={legendStyle}>Notes and style</legend>
        <TextAreaField label="Notes" value={state.notes} onChange={(event) => onChange({ notes: event.target.value })} />
        <TextAreaField label="Terms" value={state.terms} onChange={(event) => onChange({ terms: event.target.value })} />
        <SelectField
          label={quote ? 'Quotation theme' : 'Invoice theme'}
          options={themes.map((theme) => ({ value: theme.id, label: theme.name }))}
          hint="Make or change themes in the Themes tab."
          value={state.themeId}
          onChange={(event) => onChange({ themeId: event.target.value })}
        />
      </fieldset>
    </div>
  );
}
