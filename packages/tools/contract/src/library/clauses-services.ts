import type { Clause } from '../library-types';
import { SERVICES_KINDS } from '../model';

const kinds = SERVICES_KINDS;

export const SERVICES_CLAUSES: readonly Clause[] = [
  {
    id: 'background',
    title: 'Background',
    kinds,
    required: true,
    paragraphs: [
      { text: 'The Freelancer provides independent professional services. The Client wishes to engage the Freelancer to provide the services described in this Agreement.' },
      { text: 'This Agreement sets out the terms on which the Freelancer will provide those services and the Client will pay for them.' },
    ],
    explanation: 'A short statement of who is doing what for whom, so the rest of the agreement has context.',
    rationale: 'Background text helps interpret the agreement if there is ever a disagreement about what the parties intended.',
    risk: 'Check with a lawyer if the Freelancer will also be an employee, director or shareholder of the Client, or if the work is for a regulated activity.',
  },
  {
    id: 'services',
    title: 'The services',
    kinds,
    required: true,
    paragraphs: [
      { text: 'The Freelancer will provide the services described in Schedule 1 (the "Services") to the Client, and will deliver the items listed in Schedule 1 (the "Deliverables").' },
      { text: 'The Freelancer will carry out the Services with reasonable skill and care and in line with the timetable in Schedule 1.' },
      { text: 'Anything not described in Schedule 1 is not part of the Services. Extra work can be added under clause {{ref:changes}}.' },
    ],
    explanation: 'The work is whatever Schedule 1 says it is, and nothing more. Anything extra needs to be agreed through the change process.',
    rationale: 'Most freelance disputes start with an unclear scope. Tying the work to a written schedule gives both sides something concrete to point to.',
    risk: 'Check with a lawyer if the scope is large, technical, or regulated, or if you cannot describe the work in a schedule with confidence.',
  },
  {
    id: 'deliverables',
    title: 'Delivery and acceptance',
    kinds,
    required: true,
    paragraphs: [
      { text: 'The Freelancer will deliver each Deliverable to the Client by email, download link or another method the Parties agree.' },
      {
        id: 'review',
        text: 'The Client has {{acceptanceDays}} after delivery to review a Deliverable and either accept it or tell the Freelancer in writing, with enough detail to act on, how it fails to meet Schedule 1.',
      },
      {
        text: 'The Freelancer will correct any failure to meet Schedule 1 at no extra charge and deliver the corrected version, which the Client then has a further {{acceptanceDays}} to review.',
      },
      {
        text: 'The fees include up to {{revisionRounds}} of revisions to each Deliverable based on the Client\'s feedback and within the scope of Schedule 1. Further revisions are changes under clause {{ref:changes}}.',
      },
      {
        id: 'accepted',
        text: 'A Deliverable is accepted when the Client says so in writing, or when the review period in clause {{ref:deliverables.review}} ends without the Client raising a problem, or when the Client first uses the Deliverable in its business (other than for testing).',
      },
    ],
    explanation: 'Work is handed over, the client has a set time to check it, problems against the agreed scope are fixed free of charge, and a fixed number of feedback rounds is included. Silence or real use counts as acceptance.',
    rationale: 'Without a review window and a deemed acceptance rule, a client can leave work unreviewed and delay payment. Without a revision limit, feedback can go on forever.',
    risk: 'Check with a lawyer if the Deliverables need formal testing, if acceptance triggers a large payment, or if you want a different rule from deemed acceptance.',
  },
  {
    id: 'fees',
    title: 'Fees and payment',
    kinds,
    required: true,
    paragraphs: [
      { id: 'amount', text: 'The Client will pay the Freelancer a fixed fee of {{fixedFee}} for the Services.', when: { option: 'feeModel', is: 'fixed' } },
      {
        text: 'The Client will pay {{advancePercent}} of the fixed fee as an advance before the Freelancer starts work, and the balance when the final Deliverable is delivered.',
        when: { all: [{ option: 'feeModel', is: 'fixed' }, { variable: 'advancePercent', gt: 0 }] },
      },
      {
        text: 'The Freelancer will invoice the fixed fee when the final Deliverable is delivered.',
        when: { all: [{ option: 'feeModel', is: 'fixed' }, { not: { variable: 'advancePercent', gt: 0 } }] },
      },
      {
        id: 'amount',
        text: 'The Client will pay the Freelancer the fee for each milestone listed in Schedule 1. The Freelancer will invoice each milestone fee when that milestone has been reached.',
        when: { option: 'feeModel', is: 'milestones' },
      },
      {
        id: 'amount',
        text: 'The Client will pay the Freelancer {{hourlyRate}} for each hour worked on the Services. The Freelancer will keep a record of the hours worked, send it with each monthly invoice, and invoice monthly for the hours worked in the previous month.',
        when: { option: 'feeModel', is: 'hourly' },
      },
      {
        text: 'The Freelancer\'s estimate for the Services is {{estimatedHours}}. This is an estimate and not a limit, and the Freelancer will tell the Client promptly if it expects the work to go well beyond it.',
        when: { all: [{ option: 'feeModel', is: 'hourly' }, { variable: 'estimatedHours', gt: 0 }] },
      },
      {
        id: 'amount',
        text: 'The Client will pay the Freelancer a monthly retainer of {{retainerFee}} for the Services, invoiced at the start of each month.',
        when: { option: 'feeModel', is: 'retainer' },
      },
      {
        text: 'The retainer covers up to {{retainerHours}} of work each month. Work beyond that is charged only if the Client has agreed to it in advance under clause {{ref:changes}}. Unused hours do not carry over to the next month unless the Parties agree otherwise in writing.',
        when: { all: [{ option: 'feeModel', is: 'retainer' }, { variable: 'retainerHours', gt: 0 }] },
      },
      {
        id: 'payment',
        text: 'The Client will pay each invoice within {{paymentDays}} of receiving it, by bank transfer, UPI or another method the Parties agree.',
      },
      {
        text: 'All fees are exclusive of GST. If the Freelancer is required to charge GST, it will be added at the applicable rate and shown separately on a valid tax invoice, and the Client will pay it together with the fee.',
        when: { option: 'gst', is: 'exclusive' },
      },
      {
        text: 'The Freelancer is not registered for GST and does not charge it. If the Freelancer later has to register, it will tell the Client in writing, and GST will be added at the applicable rate to invoices issued after that date.',
        when: { option: 'gst', is: 'not-registered' },
      },
      {
        id: 'tds',
        text: 'If the law requires the Client to deduct tax at source (TDS) from a payment, the Client may deduct it, will pay the amount deducted to the government on time, and will give the Freelancer a TDS certificate as the law requires. The amount deducted counts as paid towards the invoice. The Freelancer will give the Client the details (such as its PAN) that the Client needs to deduct tax correctly.',
      },
      {
        text: 'If the Client does not pay an undisputed amount by its due date, the Client will pay simple interest on the overdue amount at {{lateInterestPercent}} per month, counted by the day, from the due date until the date of payment.',
        when: { option: 'latePayment', is: 'interest' },
      },
      {
        text: 'If an undisputed invoice remains unpaid {{pauseAfterDays}} after its due date, the Freelancer may pause work by giving the Client written notice, and the timetable moves back by the length of the pause. Work resumes when the invoice is paid.',
      },
      {
        text: 'If the Client disputes part of an invoice in good faith, it will tell the Freelancer in writing, with reasons, within {{invoiceDisputeDays}} of receiving the invoice, and will pay the undisputed part on time. The Parties will try to settle the disputed part under clause {{ref:disputes}}.',
      },
    ],
    explanation:
      'This sets how much the client pays, when, and how GST and TDS are handled. Fees are shown without GST, and the client may deduct TDS as the law requires and must provide the certificate. Late payment can carry interest (if you chose it), and the freelancer may pause work if a bill stays unpaid.',
    rationale: 'Clear payment terms are the best protection against late payment. Spelling out GST and TDS avoids the most common arguments about what the invoice amount should be.',
    risk: 'Check with a lawyer or chartered accountant if your GST status, the TDS rate or section that applies to this payment, or the interest rate is uncertain, or if the Client is outside India.',
  },
  {
    id: 'expenses',
    title: 'Expenses',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'The Client will reimburse reasonable out-of-pocket expenses that the Freelancer incurs for the Services (such as stock assets, licences, paid tools or travel), at cost and with receipts, but only if the Client approved them in writing (email is enough) before they were incurred.',
        when: { option: 'expenses', is: 'pre-approved' },
      },
      { text: 'Expenses will be shown separately on the invoice.', when: { option: 'expenses', is: 'pre-approved' } },
      {
        text: 'The fees include all of the Freelancer\'s expenses, and the Freelancer may not charge extra for them unless the Client has agreed in writing in advance.',
        when: { option: 'expenses', is: 'included' },
      },
    ],
    explanation: 'Either the client repays pre-approved expenses at cost, or the fee already covers them.',
    rationale: 'Surprise expenses are a common source of friction. Requiring approval in advance protects the client; allowing reimbursement protects the freelancer from absorbing costs.',
    risk: 'Check with a lawyer if there will be large expenses, travel, or third-party licences that carry legal terms of their own.',
  },
  {
    id: 'changes',
    title: 'Changes to the scope',
    kinds,
    required: true,
    paragraphs: [
      { text: 'Either Party may ask for a change to the Services, the Deliverables or the timetable by writing to the other.' },
      { text: 'Within {{changeResponseDays}} the Freelancer will tell the Client whether it can make the change and how it would affect the fees and the timetable.' },
      { text: 'A change takes effect only when both Parties have agreed to it in writing (an email exchange is enough). Until then the Freelancer continues on the existing terms.' },
    ],
    explanation: 'Changes are fine, but only once both sides agree the price and timing in writing.',
    rationale: 'Scope creep is the usual reason freelance projects go over time and budget. A simple written change step keeps it visible and priced.',
    risk: 'Check with a lawyer if you expect the scope to change a lot, in which case a time-and-materials arrangement may suit better than a fixed price.',
  },
  {
    id: 'client-responsibilities',
    title: 'What the Client must provide',
    kinds,
    required: true,
    paragraphs: [
      { text: 'The Client will give the Freelancer the information, materials, access and decisions that the Freelancer reasonably needs for the Services, in good time.' },
      { text: 'The Client will give feedback and approvals within {{feedbackDays}} of a request from the Freelancer.' },
      { text: 'If the Client is late, the timetable moves back by a matching period, and the Freelancer is not responsible for the resulting delay.' },
      { text: 'The Client promises that it has the right to give the Freelancer any materials it supplies (such as text, images, logos and data) and to let the Freelancer use them for the Services.' },
    ],
    explanation: 'The client has to supply what is needed and answer in a reasonable time. If the client is slow, deadlines move.',
    rationale: 'Projects fail as often because the client is slow as because the freelancer is. This makes both sides responsible for keeping things moving.',
    risk: 'Check with a lawyer if the Client will provide personal data or third-party material that comes with its own legal restrictions.',
  },
  {
    id: 'ip',
    title: 'Intellectual property',
    kinds,
    required: true,
    paragraphs: [
      {
        text: '"Pre-existing Materials" means anything the Freelancer created or owned before the Effective Date or creates independently of the Services, including its tools, templates, code libraries, methods and know-how. "Client Materials" means anything the Client gives the Freelancer for the Services.',
      },
      { text: 'The Client keeps all rights in the Client Materials. The Freelancer may use them only for the Services.' },
      {
        id: 'payment-first',
        text: 'Until the Client has paid for a Deliverable in full, the Freelancer keeps all rights in it and the Client may use it only to review and test it.',
      },
      {
        id: 'grant',
        text: 'When the Client has paid for a Deliverable in full, the Freelancer assigns to the Client all copyright and other intellectual property rights in that Deliverable (other than in the Pre-existing Materials), on the terms of clauses {{ref:ip.duration}} and {{ref:ip.territory}}.',
        when: { option: 'ip', is: 'assign' },
      },
      {
        id: 'grant',
        text: 'When the Client has paid for a Deliverable in full, the Freelancer grants the Client a non-exclusive, non-transferable licence to use, copy and adapt that Deliverable for the Client\'s own business, on the terms of clauses {{ref:ip.duration}} and {{ref:ip.territory}}. The Freelancer keeps ownership of the Deliverable and may reuse it. The Client may transfer the licence only together with the whole of its business.',
        when: { all: [{ option: 'ip', is: 'licence' }, { option: 'licenceExclusivity', is: 'non-exclusive' }] },
      },
      {
        id: 'grant',
        text: 'When the Client has paid for a Deliverable in full, the Freelancer grants the Client an exclusive, non-transferable licence to use, copy and adapt that Deliverable for the Client\'s own business, on the terms of clauses {{ref:ip.duration}} and {{ref:ip.territory}}. The Freelancer keeps ownership of the Deliverable but will not use it for anyone else or license it to anyone else during the licence. The Client may transfer the licence only together with the whole of its business.',
        when: { all: [{ option: 'ip', is: 'licence' }, { option: 'licenceExclusivity', is: 'exclusive' }] },
      },
      {
        id: 'duration',
        text: 'The rights described in clause {{ref:ip.grant}} last for the full period for which those rights exist (in perpetuity).',
        when: { option: 'ipDuration', is: 'perpetual' },
      },
      {
        id: 'duration',
        text: 'The rights described in clause {{ref:ip.grant}} last for {{ipYears}} from the date the Client pays for the Deliverable in full. After that they return to the Freelancer unless the Parties agree otherwise in writing.',
        when: { option: 'ipDuration', is: 'fixed-years' },
      },
      {
        id: 'territory',
        text: 'The rights described in clause {{ref:ip.grant}} apply in every country in the world.',
        when: { option: 'ipTerritory', is: 'worldwide' },
      },
      {
        id: 'territory',
        text: 'The rights described in clause {{ref:ip.grant}} apply in India only. The Freelancer keeps the rights in all other countries.',
        when: { option: 'ipTerritory', is: 'india' },
      },
      {
        text: 'The Freelancer grants the Client a non-exclusive licence to use any Pre-existing Materials that are built into a Deliverable, but only as part of that Deliverable, for as long as and in the same territory in which the Client holds rights in that Deliverable.',
      },
      {
        text: 'If a Deliverable contains third-party materials (such as stock images, fonts or open-source software), the Freelancer will tell the Client. Those materials stay subject to their own licence terms.',
      },
      {
        text: 'The Freelancer may describe and show the non-confidential parts of the Deliverables in its portfolio to show its work, and may name the Client as a customer, unless the Client objects in writing. The Freelancer will not use Confidential Information this way.',
        when: { option: 'portfolio', is: 'allowed' },
      },
      {
        text: 'The Freelancer will not show the Deliverables, or name the Client, in its portfolio or promotional material without the Client\'s written permission.',
        when: { option: 'portfolio', is: 'not-allowed' },
      },
    ],
    explanation:
      'Who owns the finished work and when. The freelancer keeps ownership of its own tools and earlier work. The client gets its chosen rights (outright ownership or a licence) only once it has paid in full, for the time and places you chose. A portfolio clause says whether the freelancer may show the work.',
    rationale:
      'Rights tied to full payment protect the freelancer. Stating how long the rights last and where they apply matters because Indian copyright law generally expects an assignment to say so. This template always states them rather than leaving it to default rules.',
    risk: 'Check with a lawyer if the work is a core product of the Client, includes software or designs you may reuse, uses open-source or stock material, or the Client is outside India. Also check the duration and territory you chose; a shorter or narrower grant than the Client expects can cause problems later.',
  },
  {
    id: 'confidentiality',
    title: 'Confidentiality',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'Each Party will keep confidential any non-public information that the other Party shares about its business, customers, finances, systems or plans, or that is marked as confidential or would reasonably be understood to be confidential ("Confidential Information"). It will use that information only for this Agreement, and will share it only with its employees, contractors and professional advisers who need it and are bound by duties of confidentiality, or as the law requires (after telling the other Party where the law allows).',
      },
      {
        text: 'Confidential Information does not include information that:',
        items: [
          { text: 'is or becomes public other than through a breach of this clause;' },
          { text: 'the receiving Party already knew, free of any duty of confidence;' },
          { text: 'the receiving Party lawfully receives from someone who was free to share it; or' },
          { text: 'the receiving Party develops independently without using the Confidential Information.' },
        ],
      },
      { text: 'This clause continues for {{confidentialityYears}} after this Agreement ends.' },
      { text: 'If the Parties have signed a separate non-disclosure agreement about the same subject, that agreement also continues to apply.' },
    ],
    explanation: 'Each side keeps the other\'s private business information secret and uses it only for this work. The usual exceptions apply, and the duty carries on for a set period after the agreement ends.',
    rationale: 'Freelancers see client business information and clients may share their own. A short two-way clause avoids needing a separate NDA for most projects.',
    risk: 'Check with a lawyer if the project involves trade secrets, personal data or other regulated information, in which case a full NDA or data-protection terms may be needed.',
  },
  {
    id: 'contractor',
    title: 'Independent contractor',
    kinds,
    required: true,
    paragraphs: [
      { text: 'The Freelancer is an independent contractor. Nothing in this Agreement makes the Freelancer an employee, partner or agent of the Client, or the Client an employee, partner or agent of the Freelancer. Neither Party can bind the other.' },
      { text: 'The Freelancer decides how, where and when to do the work, uses its own equipment, and is responsible for its own taxes, insurance, registrations and benefits. The Client does not provide employee benefits and does not deduct any tax other than as set out in clause {{ref:fees.tds}}.' },
      { text: 'The Freelancer may work for other clients, as long as it does not breach clause {{ref:confidentiality}} and can still meet its duties to the Client.' },
      { text: 'The Freelancer may use subcontractors only with the Client\'s written consent, which must not be unreasonably withheld. The Freelancer remains responsible for their work and for their confidentiality.' },
    ],
    explanation: 'The freelancer runs its own business, controls how the work is done and is not an employee. It can work for others and answers for any subcontractors it uses.',
    rationale: 'It keeps the relationship clear for tax and legal purposes. How the parties actually behave matters more than the label, so it should match reality.',
    risk: 'Check with a lawyer if the Freelancer will work full-time for the Client, follow the Client\'s working hours or instructions closely, or work only for the Client, because that can look like employment whatever this clause says.',
  },
  {
    id: 'term',
    title: 'Term and ending this Agreement',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'This Agreement starts on the Effective Date and continues until the Services have been completed and paid for, unless it is ended earlier under this clause.',
        when: { option: 'term', is: 'until-complete' },
      },
      {
        text: 'This Agreement starts on the Effective Date and ends on {{endDate}}, unless it is ended earlier under this clause or extended in writing by both Parties.',
        when: { option: 'term', is: 'fixed' },
      },
      {
        text: 'This Agreement starts on the Effective Date and continues until a Party ends it under this clause.',
        when: { option: 'term', is: 'ongoing' },
      },
      { id: 'early', text: 'Either Party may end this Agreement at any time by giving the other {{terminationNoticeDays}} written notice.' },
      {
        text: 'Either Party may end this Agreement immediately by written notice if the other commits a serious breach and does not fix it within {{cureDays}} of a written notice describing the breach, or if the breach cannot be fixed.',
      },
      {
        id: 'payment',
        text: 'If this Agreement ends for any reason, the Client will pay the Freelancer for all Services performed and approved expenses incurred up to the date it ends, including a fair share of the fee for work in progress, after taking off amounts already paid. If the Client has paid an advance that is more than the value of the work done, the Freelancer will refund the difference within {{paymentDays}}.',
      },
      {
        text: 'The Freelancer will hand over the work completed up to the date this Agreement ends. Rights in that work pass to the Client under clause {{ref:ip}} only once it has been paid for.',
      },
      { text: 'Clauses {{ref:fees}}, {{ref:ip}}, {{ref:confidentiality}}, {{ref:warranties}}, {{ref:liability}} and {{ref:disputes}}, and any other clause that by its nature is meant to continue, will continue after this Agreement ends.' },
    ],
    explanation: 'How long the agreement lasts and how either side can leave. On leaving, the client pays for work done and any unused advance is refunded.',
    rationale: 'A clear exit route with notice and payment for work done protects both sides: the client is not locked in and the freelancer is not left unpaid.',
    risk: 'Check with a lawyer if the project is long, expensive, or depends on a single deliverable at the end, because ending early could then cause more loss than the clause assumes.',
  },
  {
    id: 'warranties',
    title: 'Promises and disclaimer',
    kinds,
    required: true,
    paragraphs: [
      {
        text: 'The Freelancer promises that it will perform the Services with reasonable skill and care, and that, to the best of its knowledge, the Deliverables (other than the Client Materials and any third-party materials identified under clause {{ref:ip}}) will not infringe anyone else\'s copyright or other intellectual property rights.',
      },
      { text: 'The Client promises that the Client Materials, and the Freelancer\'s use of them as this Agreement allows, will not infringe anyone else\'s rights.' },
      { text: 'Each Party promises that it has the authority to enter into this Agreement.' },
      { text: 'Except for the promises written in this Agreement, neither Party gives any other promise, and promises that the law would otherwise add are excluded as far as the law allows. The Freelancer does not promise any particular business result, such as sales, rankings or revenue, from the Deliverables.' },
    ],
    explanation: 'Each side promises the basics: the freelancer will work competently and not copy others\' work; the client has the right to give its material. Nobody promises a business result.',
    rationale: 'These limited promises are what each side can honestly stand behind. Without a disclaimer about results, a client might expect guarantees that no freelancer can give.',
    risk: 'Check with a lawyer if you want stronger guarantees (for example performance targets or uptime), or if the Deliverables are used in a safety-critical or regulated setting.',
  },
  {
    id: 'liability',
    title: 'Limit of liability',
    kinds,
    required: true,
    paragraphs: [
      { text: 'Neither Party is liable to the other for indirect or consequential loss, or for loss of profit, revenue or goodwill, arising out of this Agreement.' },
      {
        id: 'cap',
        text: 'Each Party\'s total liability to the other under this Agreement is limited to the total fees paid and payable to the Freelancer under this Agreement.',
        when: { option: 'liabilityCap', is: 'fees-paid' },
      },
      {
        text: 'Nothing in this clause limits liability for:',
        items: [
          { text: 'fraud or wilful misconduct;' },
          { text: 'the Client\'s duty to pay the fees;' },
          { text: 'a breach of clause {{ref:confidentiality}}; or' },
          { text: 'anything that cannot be limited under the law.' },
        ],
      },
    ],
    explanation: 'Neither side can claim lost profit or similar indirect losses. If you chose a cap, each side\'s liability to the other is limited to the total fees under the agreement. Fraud, unpaid fees, confidentiality breaches and anything the law does not allow to be limited are not capped.',
    rationale: 'A freelancer cannot safely take on liability far greater than the fee it earns. A limit linked to the fees is a widely used, easily understood compromise.',
    risk: 'Check with a lawyer if the Deliverables could cause serious loss if wrong, if the Client asks for a higher cap or no cap, or if you want insurance to match the cap.',
  },
  {
    id: 'indemnity',
    title: 'Cover for third-party claims',
    kinds,
    required: false,
    paragraphs: [
      {
        text: 'The Freelancer will cover the Client against losses, damages and reasonable legal costs that the Client has to pay because a third party claims that a Deliverable (other than Client Materials and third-party materials identified under clause {{ref:ip}}) infringes its intellectual property rights.',
      },
      {
        text: 'The Client will cover the Freelancer against losses, damages and reasonable legal costs that the Freelancer has to pay because a third party claims that the Client Materials, or the Freelancer\'s use of them as this Agreement allows, infringe its rights.',
      },
      {
        text: 'A Party that wants cover under this clause must tell the other promptly in writing, let it take over the defence and settlement of the claim (but not settle in a way that admits fault for the covered Party without its consent), and give reasonable help at the other Party\'s cost.',
      },
      { text: 'This clause is subject to the limits in clause {{ref:liability}}.' },
    ],
    explanation: 'If someone outside the deal sues about copied material, whoever supplied that material covers the other for the cost. It is limited to claims about intellectual property and is subject to the liability limit.',
    rationale: 'The party that supplies material is best placed to know whether it has the right to use it, so it makes sense for that party to carry the risk. A short, two-way version is fair and easy to understand.',
    risk: 'Check with a lawyer if either side asks for wider cover (such as all losses or data breaches), or if the Deliverables include material that is likely to be challenged.',
  },
  {
    id: 'non-solicit',
    title: 'Not hiring each other\'s people',
    kinds,
    required: false,
    defaultIncluded: false,
    paragraphs: [
      { text: 'During this Agreement and for {{nonSolicitMonths}} afterwards, neither Party will directly try to hire or engage the other Party\'s employees or contractors who worked on the Services, without the other Party\'s written consent.' },
      { text: 'This does not stop a Party from advertising a job in general (for example on a job site) or hiring someone who responds to an advertisement or approaches it on their own.' },
    ],
    explanation: 'For a short time, neither side will go after the other\'s staff who worked on the project. General job adverts and people who approach on their own are fine. It does not stop the freelancer working for other clients.',
    rationale: 'Clients invest in a freelancer\'s team, and freelancers invest in their subcontractors; a short, narrow promise not to poach protects both. It is optional, and off by default, because many freelance projects do not need it.',
    risk: 'Check with a lawyer before including this, particularly the length. Restrictions that go further than protecting the other side\'s staff may not be enforceable. This template does not offer a clause that stops the Freelancer working in the same field after the engagement.',
  },
  {
    id: 'force-majeure',
    title: 'Events outside anyone\'s control',
    kinds,
    required: false,
    paragraphs: [
      {
        text: 'A Party is not in breach of this Agreement for a delay or failure caused by an event outside its reasonable control (such as a natural disaster, epidemic, war, riot, government order, or failure of public utilities or networks), as long as it tells the other Party promptly and takes reasonable steps to limit the effect.',
      },
      { text: 'This clause does not excuse a duty to pay money that is already due.' },
      { text: 'If the event continues for more than {{forceMajeureDays}}, either Party may end this Agreement by written notice, and clause {{ref:term.payment}} applies.' },
    ],
    explanation: 'If something truly outside anyone\'s control stops the work, neither side is blamed. Money already owed is still owed. If it drags on, either side can leave.',
    rationale: 'It is fairer to share the risk of events nobody can prevent than to treat them as breaches, and having an exit prevents the agreement being stuck indefinitely.',
    risk: 'Check with a lawyer if the project depends on a specific external risk, such as a supplier or a venue, that you want to name or exclude.',
  },
];
