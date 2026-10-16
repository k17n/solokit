import type { Clause } from '../library-types';
import { NDA_KINDS } from '../model';

const kinds = NDA_KINDS;

export const NDA_CLAUSES: readonly Clause[] = [
  {
    id: 'background',
    title: 'Background',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'The Parties wish to share certain information with each other for the Purpose (explained in clause {{ref:purpose}}) and want that information to stay confidential.',
        kinds: ['nda-mutual'],
      },
      {
        text: 'The Disclosing Party wishes to share certain information with the Receiving Party for the Purpose (explained in clause {{ref:purpose}}) and wants that information to stay confidential.',
        kinds: ['nda-one-way'],
      },
      { text: 'This Agreement sets out how the information will be protected.' },
    ],
    explanation: 'A short explanation of why the agreement exists, so a reader (or a court) can see what the parties were trying to do.',
    rationale: 'Background text helps interpret the rest of the agreement if there is ever a disagreement about what the parties intended.',
    risk: 'Check with a lawyer if the relationship is more than a simple information exchange, for example if the parties are also planning a joint venture, an investment or an acquisition.',
  },
  {
    id: 'definitions',
    title: 'Confidential Information and key terms',
    kinds,
    required: true,
    paragraphs: [
      {
        text: '"Discloser" means a Party that shares Confidential Information, and "Recipient" means a Party that receives it. Each Party can be both a Discloser and a Recipient.',
        kinds: ['nda-mutual'],
      },
      {
        text: '"Discloser" means the Disclosing Party, and "Recipient" means the Receiving Party.',
        kinds: ['nda-one-way'],
      },
      {
        id: 'meaning',
        text: '"Confidential Information" means all non-public information, in any form (written, spoken, electronic or visual), that the Discloser or its Representatives share with the Recipient in connection with the Purpose and that is either marked as confidential or would reasonably be understood to be confidential from its nature or the circumstances in which it was shared. It includes business plans, finances, pricing, customer and supplier details, software and source code, designs, data, methods and know-how.',
        when: { option: 'confidentialScope', is: 'broad' },
      },
      {
        id: 'meaning',
        text: '"Confidential Information" means non-public information, in any form, that the Discloser or its Representatives share with the Recipient in connection with the Purpose and that is either marked or described as confidential when it is shared, or, if it is shared orally or visually, is said to be confidential at the time and is confirmed as confidential in writing within {{markingDays}}.',
        when: { option: 'confidentialScope', is: 'marked' },
      },
      {
        id: 'exclusions',
        text: 'Confidential Information does not include information that:',
        items: [
          { text: 'is or becomes public other than through a breach of this Agreement by the Recipient or anyone it shares it with;' },
          { text: 'the Recipient already knew, free of any duty of confidence, before the Discloser shared it;' },
          { text: 'the Recipient lawfully receives from a third party who was free to share it; or' },
          { text: 'the Recipient develops independently without using or referring to the Confidential Information.' },
        ],
      },
      {
        text: 'The Recipient must be able to show, with reasonable evidence, that one of the exceptions in clause {{ref:definitions.exclusions}} applies.',
      },
      {
        text: '"Representatives" means a Party\'s employees, directors, partners, contractors and professional advisers (such as lawyers and accountants).',
      },
      { text: '"Purpose" has the meaning given in clause {{ref:purpose}}.' },
    ],
    explanation:
      'This says what counts as confidential and what does not. Information is protected if it is not public and was shared for the Purpose. Four normal exceptions apply: information that is already public, already known to the recipient, received legitimately from someone else, or worked out independently.',
    rationale:
      'A clear definition prevents arguments later about whether something was covered. The four exceptions are standard in NDAs because it would be unfair to stop someone using information they already had or that anyone can find.',
    risk: 'Check with a lawyer if the information includes personal data, source code, trade secrets or technical specifications that you consider especially valuable, or if you want a narrower or wider definition than the option you chose.',
  },
  {
    id: 'purpose',
    title: 'Purpose',
    kinds,
    required: true,
    paragraphs: [
      { text: 'The "Purpose" is {{purpose}}.' },
      { text: 'The Recipient may use Confidential Information only for the Purpose.' },
      { text: 'Neither Party has to share any particular information, and nothing in this Agreement obliges the Parties to enter into any further agreement or business relationship.' },
    ],
    explanation: 'The information may be used only for the reason you wrote down. Nobody has to share anything, and signing this does not commit anyone to doing business together.',
    rationale: 'Limiting use to a stated purpose is the heart of an NDA. It also makes clear that talking does not create a deal.',
    risk: 'Check with a lawyer if the purpose may change or grow (for example from a proposal to a full project), or if the Recipient might use the information in a way you have not thought of.',
  },
  {
    id: 'obligations',
    title: 'What the Recipient must do',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'The Recipient will:',
        items: [
          { text: 'keep the Confidential Information confidential and not share it, except as clause {{ref:permitted-disclosures}} or clause {{ref:compelled-disclosure}} allows;' },
          { text: 'protect it with at least the same care it uses for its own confidential information, and never with less than reasonable care;' },
          { text: 'use it only for the Purpose;' },
          { text: 'make copies only as reasonably needed for the Purpose; and' },
          { text: 'tell the Discloser promptly if it becomes aware of any unauthorised use or sharing of the Confidential Information.' },
        ],
      },
      { text: 'The Recipient will not try to reverse engineer, take apart or analyse any software, prototype or sample it receives in order to discover how it is made.' },
    ],
    explanation: 'The core promises: keep it secret, take proper care, use it only for the Purpose, copy only what is needed, and say so quickly if something leaks.',
    rationale: 'These are the practical duties that make the promise of confidentiality meaningful, written as a short checklist that is easy to follow.',
    risk: 'Check with a lawyer if you need specific security measures (such as encryption, access limits or audits) or if the information is regulated.',
  },
  {
    id: 'permitted-disclosures',
    title: 'Who else may see it',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'The Recipient may share Confidential Information with its Representatives who need to know it for the Purpose, but only if they have been told it is confidential and are bound by duties of confidentiality (by contract or by their profession) that are at least as protective as this Agreement.',
      },
      { text: 'The Recipient is responsible for anything its Representatives do or fail to do that would be a breach of this Agreement if the Recipient had done it.' },
    ],
    explanation: 'The recipient may pass information to the staff and advisers who really need it, as long as they are bound to keep it secret. The recipient is answerable for their mistakes.',
    rationale: 'In practice people need to consult colleagues, accountants and lawyers. Allowing that on a need-to-know basis, with responsibility staying with the recipient, is the usual balance.',
    risk: 'Check with a lawyer if the information is very sensitive and you want the Recipient to name or get your approval for each person who sees it.',
  },
  {
    id: 'compelled-disclosure',
    title: 'If the law requires disclosure',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'If the law, a court, a regulator or a government authority requires the Recipient to disclose Confidential Information, the Recipient may do so, but only if it:',
        items: [
          { text: 'where the law allows, tells the Discloser promptly in writing, so that the Discloser can seek a protective order or other remedy at its own cost;' },
          { text: 'discloses only the part that it is legally required to disclose; and' },
          { text: 'where reasonably possible, asks that the information be treated as confidential by whoever receives it.' },
        ],
      },
    ],
    explanation: 'If a court or authority orders the recipient to hand over information, the recipient may comply, but should warn the discloser first if allowed, share only what is required, and ask for it to be kept confidential.',
    rationale: 'No contract can override a legal duty to disclose. This clause makes sure the discloser gets a chance to protect itself.',
    risk: 'Check with a lawyer if either party is regulated (for example a bank, a listed company or a public body) or is likely to receive government requests.',
  },
  {
    id: 'term',
    title: 'How long this lasts',
    kinds,
    required: true,
    paragraphs: [
      { text: 'This Agreement starts on the Effective Date and continues for {{termMonths}}, unless a Party ends it earlier under clause {{ref:term.early}}.' },
      {
        id: 'early',
        text: 'Either Party may end this Agreement earlier by giving the other {{terminationNoticeDays}} written notice. After notice is given, no new Confidential Information may be shared under this Agreement, but the Recipient\'s duties for information already shared continue under clause {{ref:term.survival}}.',
      },
      {
        id: 'survival',
        text: 'The Recipient\'s duties for Confidential Information shared before this Agreement ends continue for {{confidentialityYears}} after the date this Agreement ends.',
      },
      {
        text: 'If any Confidential Information is a trade secret, the Recipient\'s duties for that information continue for as long as it remains a trade secret, even after the period in clause {{ref:term.survival}} has passed.',
        when: { option: 'tradeSecrets', is: 'protected' },
      },
      { text: 'Clause {{ref:return-destruction}}, clause {{ref:disputes}} and any other clause that by its nature is meant to continue will continue after this Agreement ends.' },
    ],
    explanation:
      'The agreement covers a set period for sharing information. Information shared during that period stays protected for a further period you choose after the agreement ends. Either side can end the sharing early by giving notice. Trade secrets can be protected for longer.',
    rationale: 'A fixed period for secrecy is easier to enforce and more acceptable to both sides than "forever". Many NDAs use two to five years; trade secrets are treated separately because they are only valuable while secret.',
    risk: 'Check with a lawyer if the information will stay valuable for longer than the period you chose, or if you want secrecy to last indefinitely for some categories.',
  },
  {
    id: 'return-destruction',
    title: 'Returning or destroying information',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'Within {{returnDays}} of a written request from the Discloser, or of this Agreement ending, the Recipient will return or securely destroy (as the Discloser reasonably asks) all Confidential Information it holds, and will confirm in writing that it has done so if the Discloser asks.',
      },
      {
        text: 'The Recipient may keep copies that the law or its professional rules require it to keep, or that sit in automatic electronic back-ups that cannot reasonably be deleted. Those copies stay subject to this Agreement for as long as they are kept, even after the period in clause {{ref:term.survival}}.',
      },
    ],
    explanation: 'When the discloser asks, or the agreement ends, the recipient gives back or deletes the information and can be asked to confirm that. Copies that the law makes it keep, or that sit in back-ups, stay protected.',
    rationale: 'Without a return rule, confidential material can sit on devices indefinitely. The exceptions are practical: nobody can delete a back-up tape or ignore a legal record-keeping rule.',
    risk: 'Check with a lawyer if you need proof of deletion, such as a signed certificate, or if the information includes personal data that has its own legal deletion rules.',
  },
  {
    id: 'no-licence',
    title: 'No ownership or licence',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'All Confidential Information stays the property of the Discloser (or of the third party that gave it to the Discloser). This Agreement does not give the Recipient any licence or right in it, or in any patent, copyright, trade mark or other intellectual property, other than the right to use it for the Purpose.',
      },
    ],
    explanation: 'Sharing information does not hand over ownership. The recipient may use it only for the Purpose.',
    rationale: 'This avoids any argument that sharing an idea or file amounted to giving or licensing it.',
    risk: 'Check with a lawyer if the parties might jointly create new work from the information, because this clause does not say who would own it.',
  },
  {
    id: 'no-warranty',
    title: 'No promises about the information',
    kinds,
    required: false,
    paragraphs: [
      {
        text: 'Confidential Information is provided "as is". The Discloser does not promise that it is accurate or complete, and is not liable for the Recipient\'s use of it, unless the Parties agree otherwise in a separate written agreement.',
      },
    ],
    explanation: 'The discloser is not guaranteeing that what it shares is correct or complete, and is not responsible for decisions the recipient makes using it.',
    rationale: 'Without this, a recipient might later argue that it relied on the information and was harmed by errors in it.',
    risk: 'Check with a lawyer if the information is meant to be relied on, for example in a purchase decision, because then this clause may not be what you want.',
  },
  {
    id: 'remedies',
    title: 'Remedies',
    kinds,
    required: false,
    paragraphs: [
      {
        text: 'The Recipient accepts that using or sharing Confidential Information in breach of this Agreement could cause the Discloser harm that money alone may not put right. The Discloser may therefore ask a court for an injunction or other urgent relief to stop or prevent a breach, in addition to any other remedy it has.',
      },
      { text: 'Whether to grant that relief is for the court to decide.' },
    ],
    explanation: 'If information is about to be leaked or misused, the discloser may go to court quickly to stop it, rather than only claiming money afterwards.',
    rationale: 'Damage from a leak is often hard to measure and impossible to undo, so the usual remedy is an order to stop. Recording that both sides understand this is standard.',
    risk: 'Check with a lawyer if you want the right to recover legal costs, a fixed sum for breach, or if you expect to need urgent orders in a particular place.',
  },
];
