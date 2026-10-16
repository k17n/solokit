'use client';

import { STAMP_DUTY_STATES, stampDutyNote, type Contract } from '@solokit/tool-contract';
import { Notice, SelectField, TextField } from '@solokit/ui';
import styles from './sections.module.css';

const STATE_OPTIONS = STAMP_DUTY_STATES.map((state) => ({ value: state.name, label: state.name }));

export function JurisdictionSection({ contract, errors, onChange }: { contract: Contract; errors: Record<string, string>; onChange: (next: Contract) => void }) {
  const { jurisdiction } = contract;
  const note = stampDutyNote(jurisdiction.state);
  return (
    <div className={styles.group}>
      <div className={styles.row}>
        <TextField
          label="City whose courts apply"
          hint="Disputes go to the courts of this city, or to arbitration seated here if you chose arbitration. Choose a city with a real connection to the parties or the work, for example where one of you is based or where the work is done."
          required
          autoComplete="off"
          value={jurisdiction.city}
          onChange={(event) => onChange({ ...contract, jurisdiction: { ...jurisdiction, city: event.target.value } })}
          error={errors['jurisdiction.city']}
        />
        <SelectField
          label="State"
          hint="Also decides the stamp duty rules to check."
          required
          placeholder="Choose a state"
          options={STATE_OPTIONS}
          value={jurisdiction.state}
          onChange={(event) => onChange({ ...contract, jurisdiction: { ...jurisdiction, state: event.target.value } })}
          error={errors['jurisdiction.state']}
        />
      </div>
      <TextField
        label="Place of signing (optional)"
        hint="Printed beside each signature."
        autoComplete="off"
        value={contract.placeOfSigning ?? ''}
        onChange={(event) => {
          const { placeOfSigning: _removed, ...rest } = contract;
          onChange(event.target.value.trim() === '' ? rest : { ...rest, placeOfSigning: event.target.value });
        }}
      />
      <Notice tone="warning" title={`Stamp duty: check for ${note.state}`}>
        {note.text}
      </Notice>
    </div>
  );
}
