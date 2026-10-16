import type { OptionDef } from '../library-types';
import { CONTRACT_KINDS, NDA_KINDS, SERVICES_KINDS } from '../model';

const NDA = NDA_KINDS;
const SERVICES = SERVICES_KINDS;

export const OPTIONS: readonly OptionDef[] = [
  // NDA
  {
    id: 'confidentialScope',
    label: 'What counts as confidential',
    help: 'Broad is simpler and protects more. Marked-only is narrower: only information labelled confidential (or confirmed in writing) is covered.',
    kinds: NDA,
    clauseId: 'definitions',
    default: 'broad',
    choices: [
      {
        id: 'broad',
        label: 'Everything non-public that is shared for the purpose',
        summary: 'All non-public information shared for the Purpose is protected, marked or not, if a reasonable person would see it as confidential.',
      },
      {
        id: 'marked',
        label: 'Only information marked as confidential',
        summary: 'Only information marked as confidential (or confirmed in writing after being shared orally) is protected.',
      },
    ],
  },
  {
    id: 'tradeSecrets',
    label: 'Trade secrets',
    help: 'Whether trade secrets stay protected for as long as they remain secret, even after the normal period ends.',
    kinds: NDA,
    clauseId: 'term',
    default: 'protected',
    choices: [
      {
        id: 'protected',
        label: 'Protect trade secrets for as long as they stay secret',
        summary: 'Trade secrets stay protected for as long as they remain trade secrets, beyond the normal period.',
      },
      { id: 'none', label: 'Same period for everything', summary: 'All information, including trade secrets, is protected only for the period you chose.' },
    ],
  },
  // Services: engagement
  {
    id: 'term',
    label: 'How long the agreement runs',
    help: 'Most projects end when the work is done and paid for. Choose a fixed end date or an ongoing agreement if that fits better.',
    kinds: SERVICES,
    clauseId: 'term',
    default: 'until-complete',
    choices: [
      { id: 'until-complete', label: 'Until the work is done and paid for', summary: 'The agreement ends when the Services are completed and paid for.' },
      { id: 'fixed', label: 'Until a fixed end date', summary: 'The agreement ends on a fixed date unless ended earlier or extended in writing.' },
      { id: 'ongoing', label: 'Ongoing until one side ends it', summary: 'The agreement has no end date and continues until one party gives notice.' },
    ],
  },
  {
    id: 'feeModel',
    label: 'How the freelancer is paid',
    help: 'Choose one. You will be asked for the amounts that go with it.',
    kinds: SERVICES,
    clauseId: 'fees',
    choices: [
      { id: 'fixed', label: 'One fixed fee for the whole job', summary: 'A single fixed fee, optionally with an advance.' },
      { id: 'milestones', label: 'Fees per milestone', summary: 'The fee is split into milestones, each invoiced when reached.' },
      { id: 'hourly', label: 'Hourly rate', summary: 'Paid by the hour for time worked, invoiced monthly.' },
      { id: 'retainer', label: 'Monthly retainer', summary: 'A fixed monthly fee, invoiced at the start of each month.' },
    ],
  },
  {
    id: 'gst',
    label: 'GST',
    help: 'Whether the freelancer is registered for GST. If unsure, ask your chartered accountant.',
    kinds: SERVICES,
    clauseId: 'fees',
    default: 'exclusive',
    choices: [
      { id: 'exclusive', label: 'Fees exclude GST (the freelancer charges GST where required)', summary: 'Fees are stated without GST; GST is added where the Freelancer must charge it.' },
      { id: 'not-registered', label: 'The freelancer is not registered for GST', summary: 'The Freelancer is not registered for GST; GST is added later only if registration becomes necessary.' },
    ],
  },
  {
    id: 'latePayment',
    label: 'Interest on late payment',
    help: 'Interest can encourage on-time payment. It is optional. If you are registered as a micro or small enterprise (Udyam), statutory payment-time and interest rules may apply regardless of what you write here; ask your lawyer.',
    kinds: SERVICES,
    clauseId: 'fees',
    default: 'none',
    choices: [
      { id: 'none', label: 'No interest', summary: 'No interest is charged on late payments.' },
      { id: 'interest', label: 'Charge simple interest on overdue amounts, at a rate you choose', summary: 'Simple interest at the rate you choose is charged on overdue undisputed amounts.' },
    ],
  },
  {
    id: 'expenses',
    label: 'Expenses',
    help: 'Who bears out-of-pocket costs such as stock images or paid tools.',
    kinds: SERVICES,
    clauseId: 'expenses',
    default: 'pre-approved',
    choices: [
      { id: 'pre-approved', label: 'Client repays expenses it approved in advance', summary: 'The Client repays expenses at cost if it approved them in writing beforehand.' },
      { id: 'included', label: 'The fee includes all expenses', summary: 'The fee covers all expenses; none can be added without agreement.' },
    ],
  },
  {
    id: 'ip',
    label: 'Who owns the finished work',
    help: 'Assignment transfers ownership to the client once it has paid in full. A licence lets the client use the work while the freelancer keeps ownership.',
    kinds: SERVICES,
    clauseId: 'ip',
    default: 'assign',
    choices: [
      { id: 'assign', label: 'Client owns it once paid in full', summary: 'On full payment the Freelancer assigns the intellectual property in each Deliverable to the Client.' },
      { id: 'licence', label: 'Client gets a licence; the freelancer keeps ownership', summary: 'On full payment the Client receives a licence to use each Deliverable; the Freelancer keeps ownership.' },
    ],
  },
  {
    id: 'licenceExclusivity',
    label: 'Licence type',
    help: 'Exclusive means the freelancer will not license the same work to anyone else during the licence.',
    kinds: SERVICES,
    clauseId: 'ip',
    default: 'non-exclusive',
    when: { option: 'ip', is: 'licence' },
    choices: [
      { id: 'non-exclusive', label: 'Non-exclusive', summary: 'The licence is non-exclusive, so the Freelancer may reuse the work.' },
      { id: 'exclusive', label: 'Exclusive', summary: 'The licence is exclusive, so the Freelancer will not use or license the work to anyone else during the licence.' },
    ],
  },
  {
    id: 'ipDuration',
    label: 'How long the client\'s rights last',
    help: 'Indian copyright law generally expects an assignment to state how long it lasts. The full legal period is the usual choice.',
    kinds: SERVICES,
    clauseId: 'ip',
    default: 'perpetual',
    choices: [
      { id: 'perpetual', label: 'For the full period the rights exist under applicable law', summary: 'The rights last for the full period for which they exist under applicable law.' },
      { id: 'fixed-years', label: 'A fixed number of years', summary: 'The rights last for a fixed number of years and then return to the Freelancer.' },
    ],
  },
  {
    id: 'ipTerritory',
    label: 'Where the client\'s rights apply',
    help: 'Indian copyright law generally expects an assignment to state where it applies. Worldwide is the usual choice.',
    kinds: SERVICES,
    clauseId: 'ip',
    default: 'worldwide',
    choices: [
      { id: 'worldwide', label: 'Worldwide', summary: 'The rights apply in every country in the world.' },
      { id: 'india', label: 'India only', summary: 'The rights apply in India only.' },
    ],
  },
  {
    id: 'portfolio',
    label: 'Showing the work in the freelancer\'s portfolio',
    help: 'Whether the freelancer can show non-confidential parts of the work to win other clients.',
    kinds: SERVICES,
    clauseId: 'ip',
    default: 'allowed',
    choices: [
      { id: 'allowed', label: 'Freelancer may show the work and name the client', summary: 'The Freelancer may show the non-confidential work in its portfolio and name the Client unless the Client objects.' },
      { id: 'not-allowed', label: 'Not without the client\'s permission', summary: 'The Freelancer may not show the work or name the Client without written permission.' },
    ],
  },
  {
    id: 'liabilityCap',
    label: 'Limit on how much either side can owe the other',
    help: 'A cap linked to the fees is common. Without a cap, a mistake could in theory cost far more than the fee.',
    kinds: SERVICES,
    clauseId: 'liability',
    default: 'fees-paid',
    choices: [
      { id: 'fees-paid', label: 'Capped at the total fees under this agreement', summary: 'Each party\'s total liability is capped at the total fees paid and payable under the agreement.' },
      { id: 'none', label: 'No cap', summary: 'There is no cap on liability (indirect and consequential loss is still excluded).' },
    ],
  },
  {
    id: 'mediation',
    label: 'Mediation before court or arbitration',
    help: 'Mediation is a facilitated negotiation. It is usually cheaper than a court case but adds time.',
    kinds: SERVICES,
    clauseId: 'disputes',
    default: 'no',
    choices: [
      { id: 'no', label: 'No mediation step', summary: 'Disputes go from talks straight to court or arbitration.' },
      { id: 'yes', label: 'Try mediation first', summary: 'Disputes go from talks to mediation, then to court or arbitration.' },
    ],
  },
  // Shared
  {
    id: 'disputeMethod',
    label: 'If talks fail',
    help: 'Courts of the city you chose, or private arbitration under the Arbitration and Conciliation Act 1996. Choose a city that has a connection to the parties or the work.',
    kinds: CONTRACT_KINDS,
    clauseId: 'disputes',
    default: 'courts',
    choices: [
      { id: 'courts', label: 'Go to the courts of the chosen city', summary: 'Unresolved disputes go to the courts at the chosen city.' },
      { id: 'arbitration', label: 'Arbitration', summary: 'Unresolved disputes go to arbitration under the Arbitration and Conciliation Act 1996.' },
    ],
  },
  {
    id: 'arbitrators',
    label: 'Number of arbitrators',
    help: 'One arbitrator is faster and cheaper. Three suits larger disputes.',
    kinds: CONTRACT_KINDS,
    clauseId: 'disputes',
    default: 'one',
    when: { option: 'disputeMethod', is: 'arbitration' },
    choices: [
      { id: 'one', label: 'One arbitrator', summary: 'A single arbitrator decides the dispute.' },
      { id: 'three', label: 'Three arbitrators', summary: 'A tribunal of three arbitrators decides the dispute.' },
    ],
  },
  {
    id: 'stampCost',
    label: 'Who pays the stamp duty',
    help: 'Only matters if the stamp duty clause is included.',
    kinds: CONTRACT_KINDS,
    clauseId: 'stamp-duty',
    default: 'equally',
    when: { included: 'stamp-duty' },
    choices: [
      { id: 'equally', label: 'Shared equally', summary: 'Both parties share the stamp duty equally.' },
      { id: 'a-pays', label: 'The {{a}} pays', summary: 'The {{a}} pays the stamp duty.' },
      { id: 'b-pays', label: 'The {{b}} pays', summary: 'The {{b}} pays the stamp duty.' },
    ],
  },
];
