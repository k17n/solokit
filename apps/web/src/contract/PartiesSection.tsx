'use client';

import { ROLE_LABELS, STAMP_DUTY_STATES, type Contract, type Party, type PartyRole } from '@solokit/tool-contract';
import { Button, Notice, RadioCards, SelectField, TextField } from '@solokit/ui';
import { fillParty, updateParty, type PartyChoice } from './editorModel';
import { Disclosure } from './Disclosure';
import styles from './sections.module.css';

const ROLE_HINT: Record<PartyRole, string> = {
  first: 'One of the two sides. Both promise to keep what the other shares secret.',
  second: 'The other side. Both promise to keep what the other shares secret.',
  disclosing: 'The side sharing its confidential information.',
  receiving: 'The side receiving that information and promising to keep it secret.',
  freelancer: 'The person or business doing the work. This is usually you.',
  client: 'The person or business paying for the work.',
};

const STATE_OPTIONS = STAMP_DUTY_STATES.map((state) => ({ value: state.name, label: state.name }));

export interface PartiesSectionProps {
  contract: Contract;
  /** Messages keyed like `parties.0.name`. */
  errors: Record<string, string>;
  choices: PartyChoice[];
  hasProfile: boolean;
  onChange: (next: Contract) => void;
  /**
   * For a one-way NDA with a business profile: which side the person is. Nothing is filled in until they say, because the
   * wrong side would put their details on the wrong party.
   */
  sideChoice?: { value: 'disclosing' | 'receiving' | ''; onPick: (side: 'disclosing' | 'receiving') => void } | undefined;
  /** Swaps the details of the two sides. */
  onSwap?: (() => void) | undefined;
}

function PartyFields({
  index,
  party,
  errors,
  choices,
  onPatch,
  onFill,
}: {
  index: number;
  party: Party;
  errors: Record<string, string>;
  choices: PartyChoice[];
  onPatch: (patch: Parameters<typeof updateParty>[2]) => void;
  onFill: (choice: PartyChoice) => void;
}) {
  const at = (field: string) => `parties.${index}.${field}`;
  const err = (field: string) => errors[at(field)];
  const hasIds = Boolean(party.pan || party.gstin || party.cin);
  const idsError = Boolean(err('pan') || err('gstin') || err('cin'));
  const label = ROLE_LABELS[party.role];
  return (
    <fieldset className={`${styles.group} ${styles.party}`}>
      <legend className={styles.legend}>
        Party {index + 1}: {label}
      </legend>
      <p className={styles.sub}>{ROLE_HINT[party.role]}</p>
      {choices.length > 0 ? (
        <SelectField
          label={`Fill in the ${label} from saved details`}
          hint="Copies the name, address and email. You can still change anything."
          placeholder="Choose…"
          value=""
          options={choices.map((choice) => ({ value: choice.id, label: choice.label }))}
          onChange={(event) => {
            const choice = choices.find((candidate) => candidate.id === event.target.value);
            if (choice) onFill(choice);
          }}
        />
      ) : null}
      <TextField
        label={`${label}: full name`}
        hint="The legal name: a person, a firm or a company."
        required
        autoComplete="off"
        value={party.name}
        onChange={(event) => onPatch({ name: event.target.value })}
        error={err('name')}
      />
      <TextField label="Address line 1" required autoComplete="off" value={party.address.line1} onChange={(event) => onPatch({ address: { line1: event.target.value } })} error={err('address.line1')} />
      <TextField label="Address line 2" autoComplete="off" value={party.address.line2 ?? ''} onChange={(event) => onPatch({ address: { line2: event.target.value } })} />
      <div className={styles.row}>
        <TextField label="City" required autoComplete="off" value={party.address.city} onChange={(event) => onPatch({ address: { city: event.target.value } })} error={err('address.city')} />
        <SelectField label="State" placeholder="Choose a state" value={party.address.state ?? ''} options={STATE_OPTIONS} onChange={(event) => onPatch({ address: { state: event.target.value } })} />
        <TextField label="PIN code" autoComplete="off" inputMode="numeric" value={party.address.postalCode ?? ''} onChange={(event) => onPatch({ address: { postalCode: event.target.value } })} />
      </div>
      <TextField
        label="Email for notices"
        hint="Formal notices under the agreement are sent here."
        required
        type="email"
        autoComplete="off"
        value={party.email}
        onChange={(event) => onPatch({ email: event.target.value })}
        error={err('email')}
      />
      <div className={styles.row}>
        <TextField
          label="Signatory's name"
          hint="The person who will sign for this party."
          required
          autoComplete="off"
          value={party.signatoryName}
          onChange={(event) => onPatch({ signatoryName: event.target.value })}
          error={err('signatoryName')}
        />
        <TextField
          label="Signatory's role"
          hint="For example Director, Partner or Proprietor."
          required
          autoComplete="off"
          value={party.signatoryTitle}
          onChange={(event) => onPatch({ signatoryTitle: event.target.value })}
          error={err('signatoryTitle')}
        />
      </div>
      <Disclosure className={styles.disclosure} defaultOpen={hasIds} openWhen={idsError} summary="Tax and company numbers (optional)">
        <div className={styles.row}>
          <TextField label="PAN" autoComplete="off" value={party.pan ?? ''} onChange={(event) => onPatch({ pan: event.target.value.toUpperCase() })} error={err('pan')} />
          <TextField label="GSTIN" autoComplete="off" value={party.gstin ?? ''} onChange={(event) => onPatch({ gstin: event.target.value.toUpperCase() })} error={err('gstin')} />
          <TextField label="CIN (companies)" autoComplete="off" value={party.cin ?? ''} onChange={(event) => onPatch({ cin: event.target.value.toUpperCase() })} error={err('cin')} />
        </div>
      </Disclosure>
    </fieldset>
  );
}

export function PartiesSection({ contract, errors, choices, hasProfile, onChange, sideChoice, onSwap }: PartiesSectionProps) {
  const [first, second] = contract.parties;
  return (
    <div className={styles.group}>
      {sideChoice ? (
        <RadioCards
          legend="Which side are you?"
          hint="SoloKit fills your side in from your business profile. Until you choose, neither side is filled in."
          name="which-side"
          value={sideChoice.value}
          onChange={(side) => sideChoice.onPick(side as 'disclosing' | 'receiving')}
          options={[
            { value: 'disclosing', label: 'Disclosing Party', description: 'You share your confidential information with the other side, for example showing a client your plans.' },
            { value: 'receiving', label: 'Receiving Party', description: "You receive the other side's confidential information and promise to keep it secret, for example a client briefing you before you quote." },
          ]}
        />
      ) : null}
      {onSwap && first && second ? (
        <div className={styles.swap}>
          <Button variant="secondary" onClick={onSwap}>
            Swap parties
          </Button>
          <span className={styles.muted}>
            Moves everything typed for the {ROLE_LABELS[first.role]} to the {ROLE_LABELS[second.role]}, and the other way round.
          </span>
        </div>
      ) : null}
      {!hasProfile ? (
        <Notice tone="info" title="Save your details once">
          SoloKit can fill in your own details from your business profile. Add them once under <a href="/business/">Your business</a> and they appear here, in your invoices and in every agreement. Until then, type the details below.
        </Notice>
      ) : null}
      {contract.parties.map((party, index) => (
        <PartyFields
          key={party.role}
          index={index}
          party={party}
          errors={errors}
          choices={choices}
          onPatch={(patch) => onChange(updateParty(contract, index, patch))}
          onFill={(choice) => onChange(fillParty(contract, index, choice.source))}
        />
      ))}
    </div>
  );
}
