import type { Clause } from '../library-types';
import { CONTRACT_KINDS } from '../model';

const kinds = CONTRACT_KINDS;

export const SHARED_CLAUSES: readonly Clause[] = [
  {
    id: 'disputes',
    title: 'Governing law and disputes',
    kinds,
    required: true,
    paragraphs: [
      { text: 'This Agreement is governed by the laws of India.' },
      {
        id: 'talks',
        text: 'If a dispute arises out of this Agreement, a Party will give the other written notice describing it, and the Parties will try in good faith to settle it by discussion between their signatories (or people they name) for {{talksDays}} after that notice.',
      },
      {
        id: 'mediation',
        text: 'If the dispute is not settled by discussion, either Party may refer it to mediation by a single mediator the Parties agree on. The Parties will share the mediator\'s fees equally and bear their own costs. If the dispute is not settled within {{mediationDays}} of the referral, either Party may go on to the next step.',
        kinds: ['services'],
        when: { option: 'mediation', is: 'yes' },
      },
      {
        id: 'courts',
        text: 'If the dispute is not settled by the steps above, the courts at {{city}}, {{state}} have exclusive jurisdiction over it.',
        when: { option: 'disputeMethod', is: 'courts' },
      },
      {
        id: 'arbitration',
        text: 'If the dispute is not settled by the steps above, it will be finally resolved by arbitration under the Arbitration and Conciliation Act 1996 (including any amendment or re-enactment of it). The seat and place of arbitration is {{arbitrationSeat}} and the language of the arbitration is English.',
        when: { option: 'disputeMethod', is: 'arbitration' },
      },
      {
        text: 'The tribunal will have a single arbitrator, chosen by agreement of the Parties or, if they do not agree within 15 days of a written request, appointed as the Act provides.',
        when: { all: [{ option: 'disputeMethod', is: 'arbitration' }, { option: 'arbitrators', is: 'one' }] },
      },
      {
        text: 'The tribunal will have three arbitrators. Each Party appoints one, and those two appoint the third, who presides. If an appointment is not made within 30 days of a written request, it will be made as the Act provides.',
        when: { all: [{ option: 'disputeMethod', is: 'arbitration' }, { option: 'arbitrators', is: 'three' }] },
      },
      {
        text: 'The award is final and binding on the Parties. The courts at {{arbitrationSeat}} have exclusive jurisdiction over matters that the Act leaves to the courts, such as interim measures and enforcement.',
        when: { option: 'disputeMethod', is: 'arbitration' },
      },
      {
        text: 'Nothing in this clause stops a Party from asking a competent court for urgent interim relief (such as an injunction) at any time.',
      },
      { text: 'While a dispute is being resolved, each Party will continue to perform its duties that are not in dispute.' },
    ],
    explanation:
      'Indian law applies. If there is a disagreement the parties talk first, then (if you chose it) try mediation, then go to the courts of your chosen city or to arbitration. Either side can still ask a court for urgent orders at any time, and work continues on the parts not in dispute.',
    rationale: 'Agreeing the steps in advance saves time and cost. Talking first often resolves a dispute; naming one place for court or arbitration avoids a fight about where to sue.',
    risk: 'Check with a lawyer if either party is outside India, if the amounts are large, or if you are unsure whether arbitration or the courts of your city suits you. Arbitration can be quicker and private but has its own costs; the courts may be cheaper for small claims.',
  },
  {
    id: 'notices',
    title: 'Notices',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'A notice under this Agreement must be in writing and sent by email to the email address, or by courier or registered post to the address, shown for the receiving Party at the start of this Agreement, or to another address the Party has given by notice.',
      },
      {
        text: 'A notice sent by email is treated as received on the next working day after it is sent, unless the sender gets a message that it was not delivered. A notice sent by courier or post is treated as received on the third working day after it is sent.',
      },
      { text: 'Everyday messages about the work do not need to follow this clause.' },
    ],
    explanation: 'Formal notices go by email or courier to the addresses at the top of the agreement, and are treated as received after a short, fixed time.',
    rationale: 'Agreeing how and where to send notices removes arguments about whether a notice was received.',
    risk: 'Check with a lawyer if a notice could have serious consequences (such as ending the agreement) and you want a stricter delivery method, or if either party changes address often.',
  },
  {
    id: 'assignment',
    title: 'No transfer without consent',
    kinds,
    required: true,
    paragraphs: [
      { text: 'Neither Party may transfer its rights or duties under this Agreement to anyone else without the other Party\'s written consent, which must not be unreasonably withheld.' },
    ],
    explanation: 'Neither side can hand the agreement over to someone else without the other\'s written agreement.',
    rationale: 'Each side chose to deal with the other. This keeps it that way unless both agree otherwise.',
    risk: 'Check with a lawyer if either party may be sold or restructured, or if the Freelancer may need to continue the work through a company.',
  },
  {
    id: 'stamp-duty',
    title: 'Stamp duty',
    kinds,
    required: false,
    paragraphs: [
      { text: 'The Parties will arrange for this Agreement to be stamped as the law of the relevant state requires. The stamp duty will be paid by both Parties in equal shares.', when: { option: 'stampCost', is: 'equally' } },
      { text: 'The Parties will arrange for this Agreement to be stamped as the law of the relevant state requires. The stamp duty will be paid by the {{a}}.', when: { option: 'stampCost', is: 'a-pays' } },
      { text: 'The Parties will arrange for this Agreement to be stamped as the law of the relevant state requires. The stamp duty will be paid by the {{b}}.', when: { option: 'stampCost', is: 'b-pays' } },
    ],
    explanation: 'Agreements in India are often subject to stamp duty, which depends on the state. This clause records that the parties will get the document stamped properly and who pays.',
    rationale: 'A document that should have been stamped may not be accepted as evidence in court until the duty (and any penalty) is paid. Agreeing who pays up front avoids an argument later. This template cannot tell you the amount or the method for your state.',
    risk: 'Check with a lawyer or your state\'s stamp office, because the rules, amounts and methods (e-stamping or stamp paper) differ between states and may depend on the type of document.',
  },
  {
    id: 'entire-agreement',
    title: 'Whole agreement',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'This Agreement is the whole agreement between the Parties about its subject and replaces all earlier discussions and understandings about it. Each Party confirms that it has not relied on any statement that is not written in this Agreement. This does not exclude liability for fraud.',
        kinds: ['nda-mutual', 'nda-one-way'],
      },
      {
        text: 'This Agreement, including Schedule 1, is the whole agreement between the Parties about its subject and replaces all earlier discussions, proposals and understandings about it. Each Party confirms that it has not relied on any statement that is not written in this Agreement. This does not exclude liability for fraud.',
        kinds: ['services'],
      },
    ],
    explanation: 'What is written here is the deal. Earlier emails, calls and proposals no longer count unless they are in this document.',
    rationale: 'It stops either side relying on something said earlier that is not in the signed text.',
    risk: 'Check with a lawyer if there are earlier agreements, proposals or promises that you want to keep in force.',
  },
  {
    id: 'amendments',
    title: 'Changes and waiver',
    kinds,
    required: true,
    paragraphs: [
      { text: 'This Agreement can be changed only in writing that both Parties have signed (electronic signatures are fine).', kinds: ['nda-mutual', 'nda-one-way'] },
      {
        text: 'This Agreement can be changed only in writing. A change to the Services, Deliverables or timetable can be agreed by an email exchange under clause {{ref:changes}}. Any other change must be in a document that both Parties have signed (electronic signatures are fine).',
        kinds: ['services'],
      },
      { text: 'If a Party does not enforce a right straight away, that does not mean it gives the right up.' },
    ],
    explanation: 'The agreement can be changed only in writing that both sides agree to. Not insisting on a right immediately does not lose it.',
    rationale: 'It prevents arguments about informal changes and stops one side claiming the other gave up a right by staying quiet.',
    risk: 'Check with a lawyer if you expect to make informal changes often and want to keep a clear record of them.',
  },
  {
    id: 'severability',
    title: 'If part is unenforceable',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'If a court or arbitral tribunal finds that part of this Agreement cannot be enforced, the rest of it stays in force, and the Parties will, where possible, replace the unenforceable part with one that can be enforced and comes closest to its intention.',
      },
    ],
    explanation: 'If one part turns out to be invalid, the rest of the agreement still works.',
    rationale: 'Standard protection so that a problem with one clause does not undo the whole agreement.',
    risk: 'Check with a lawyer if one clause is so central that the agreement would make no sense without it.',
  },
  {
    id: 'counterparts',
    title: 'Counterparts and electronic signature',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'This Agreement may be signed in counterparts (separate copies), which together form one agreement. Each Party may sign electronically, or sign a printed copy and share a scan or photo, and this has the same effect as a signed original to the extent the law of India allows.',
      },
      { text: 'Each person who signs confirms that they are authorised to sign for the Party named.' },
    ],
    explanation: 'The parties may sign separate copies and may sign electronically or send a scan. Whoever signs confirms they have the authority.',
    rationale: 'It lets people in different places sign without printing and posting documents, and puts the authority question on record.',
    risk: 'Check with a lawyer if the document must be signed on stamp paper, witnessed, notarised or registered, because electronic signatures may not be enough on their own.',
  },
];
