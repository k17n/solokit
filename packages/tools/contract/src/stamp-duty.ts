/**
 * Stamp duty on an agreement depends on the state. This list deliberately holds no rates, no amounts and no
 * claims about which method a state uses: those could not be checked offline and a wrong figure would do
 * harm. Every entry says "verify", and the review pack turns that into a question for the lawyer.
 *
 * To record a verified fact later, change `commonlyRequired` or `method` for that state and update
 * {@link STAMP_DUTY_AS_OF}.
 */
export const STAMP_DUTY_AS_OF = '2026-10-16';

export type StampFact = 'verify' | 'yes' | 'no';
export type StampMethod = 'verify' | 'e-stamping' | 'stamp-paper' | 'both';

export interface StampDutyState {
  name: string;
  kind: 'state' | 'union-territory';
  /** Whether an agreement like this commonly needs stamp duty in this state. */
  commonlyRequired: StampFact;
  /** Whether e-stamping or stamp paper is the usual way to pay it. */
  method: StampMethod;
}

const entry = (name: string, kind: StampDutyState['kind'] = 'state'): StampDutyState => ({ name, kind, commonlyRequired: 'verify', method: 'verify' });

export const STAMP_DUTY_STATES: readonly StampDutyState[] = [
  entry('Andhra Pradesh'),
  entry('Arunachal Pradesh'),
  entry('Assam'),
  entry('Bihar'),
  entry('Chhattisgarh'),
  entry('Goa'),
  entry('Gujarat'),
  entry('Haryana'),
  entry('Himachal Pradesh'),
  entry('Jharkhand'),
  entry('Karnataka'),
  entry('Kerala'),
  entry('Madhya Pradesh'),
  entry('Maharashtra'),
  entry('Manipur'),
  entry('Meghalaya'),
  entry('Mizoram'),
  entry('Nagaland'),
  entry('Odisha'),
  entry('Punjab'),
  entry('Rajasthan'),
  entry('Sikkim'),
  entry('Tamil Nadu'),
  entry('Telangana'),
  entry('Tripura'),
  entry('Uttar Pradesh'),
  entry('Uttarakhand'),
  entry('West Bengal'),
  entry('Andaman and Nicobar Islands', 'union-territory'),
  entry('Chandigarh', 'union-territory'),
  entry('Dadra and Nagar Haveli and Daman and Diu', 'union-territory'),
  entry('Delhi', 'union-territory'),
  entry('Jammu and Kashmir', 'union-territory'),
  entry('Ladakh', 'union-territory'),
  entry('Lakshadweep', 'union-territory'),
  entry('Puducherry', 'union-territory'),
];

export const isKnownState = (name: string): boolean => STAMP_DUTY_STATES.some((state) => state.name === name);

export interface StampDutyNote {
  state: string;
  asOf: string;
  commonlyRequired: StampFact;
  method: StampMethod;
  /** Always tells the reader to check; never gives an amount. */
  text: string;
}

/** What to say about stamp duty for a state. The text never contains an amount. */
export function stampDutyNote(stateName: string): StampDutyNote {
  const found = STAMP_DUTY_STATES.find((state) => state.name === stateName);
  const state = found ?? { name: stateName, commonlyRequired: 'verify' as const, method: 'verify' as const };
  const where = stateName.trim() === '' ? 'your state' : stateName.trim();
  return {
    state: where,
    asOf: STAMP_DUTY_AS_OF,
    commonlyRequired: state.commonlyRequired,
    method: state.method,
    text: `Verify for ${where}: whether this document needs stamp duty, how much, and whether to use e-stamping or stamp paper. SoloKit does not hold amounts, because they differ by state and by document and change over time. Check ${where === 'your state' ? "your state's" : `${where}'s`} stamp office or ask your lawyer. Information as of ${STAMP_DUTY_AS_OF}.`,
  };
}
