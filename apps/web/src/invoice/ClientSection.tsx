'use client';

import type { Client } from '@solokit/tool-invoice';
import { CheckboxField, SelectField, TextField } from '@solokit/ui';
import { applyClientGstin, type ClientFormState } from './clientFormState';
import { selectableStates } from './profileFormState';

export interface ClientSectionProps {
  value: ClientFormState;
  /** The id of the client being edited: a saved client's id, or a fresh id for a new one. */
  clientId: string;
  savedClients: Client[];
  isExport: boolean;
  saveClient: boolean;
  /** Messages keyed like `client.name`. */
  errors: Record<string, string>;
  onChange: (next: ClientFormState) => void;
  onSelectClient: (client: Client | null) => void;
  onSaveClientChange: (save: boolean) => void;
}

export function ClientSection({
  value,
  clientId,
  savedClients,
  isExport,
  saveClient,
  errors,
  onChange,
  onSelectClient,
  onSaveClientChange,
}: ClientSectionProps) {
  const set = <K extends keyof ClientFormState>(key: K, next: ClientFormState[K]) => onChange({ ...value, [key]: next });
  const text = (key: Exclude<keyof ClientFormState, never>) => ({
    value: value[key],
    onChange: (event: { target: { value: string } }) => set(key, event.target.value),
  });
  const selected = savedClients.some((client) => client.id === clientId) ? clientId : '';

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {savedClients.length > 0 ? (
        <SelectField
          label="Client"
          placeholder="New client"
          options={savedClients.map((client) => ({ value: client.id, label: client.name }))}
          value={selected}
          onChange={(event) => onSelectClient(savedClients.find((client) => client.id === event.target.value) ?? null)}
        />
      ) : null}
      <TextField label="Client name" required autoComplete="off" {...text('name')} error={errors['client.name']} />
      {!isExport ? (
        <TextField
          label="Client GSTIN"
          hint="Leave empty if your client is not registered for GST."
          autoComplete="off"
          value={value.gstin}
          onChange={(event) => onChange(applyClientGstin(value, event.target.value))}
          error={errors['client.gstin']}
        />
      ) : null}
      <TextField label="Address line 1" required autoComplete="off" {...text('line1')} error={errors['client.address.line1']} />
      <TextField label="Address line 2" autoComplete="off" {...text('line2')} />
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', alignItems: 'start' }}>
        <TextField label="City" required autoComplete="off" {...text('city')} error={errors['client.address.city']} />
        <TextField label="PIN code" autoComplete="off" {...text('postalCode')} />
        {isExport ? (
          <TextField label="Country" required autoComplete="off" {...text('country')} error={errors['client.address.country']} />
        ) : (
          <SelectField label="State" placeholder="Choose a state" options={selectableStates()} {...text('stateCode')} />
        )}
      </div>
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', alignItems: 'start' }}>
        <TextField label="Email" type="email" autoComplete="off" {...text('email')} error={errors['client.email']} />
        <TextField label="Phone" type="tel" autoComplete="off" {...text('phone')} />
      </div>
      <CheckboxField
        label="Save this client for next time"
        checked={saveClient}
        onChange={(event) => onSaveClientChange(event.target.checked)}
      />
    </div>
  );
}
