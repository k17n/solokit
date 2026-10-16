# Legal content notes for review

Template wording version 2026-10-16.1. Generated from the clause library in packages/tools/contract/src/library, then edited by hand where marked. A test keeps the ids in this file in step with the library.

## What this is

SoloKit generates three documents from neutral, plain-English templates: a mutual NDA, a one-way NDA and a freelance services agreement. They are templates, not legal advice, and they are meant for a lawyer who practises in India to review. This file lists every legal assumption, default and drafting choice so the review can be quick and complete. The full wording of any generated document is in the Review pack export.

## Decisions made by the product owner

- Neutral between the parties; plain English; no case-law or statute citations. The only statute named is the Arbitration and Conciliation Act 1996 (arbitration option).
- No clause restraining the freelancer from working in the same field after the engagement (non-compete) is offered. Reason given in the document: such post-engagement restraints are generally not enforceable in India. Please confirm. An optional, narrow non-solicitation of staff clause exists and is off by default.
- IP assignment always states duration and territory (defaults: perpetual, worldwide) because Indian copyright law generally expects them. Please confirm the position and whether the defaults are sensible.
- Stamp duty: the documents include an optional clause saying the parties will stamp the agreement and who pays (default: shared equally). The tool holds NO amounts and makes NO claim about which method each state uses; every state is marked "verify". Please advise what, if anything, should be stated per state.
- Governing law is the law of India for every document. Both parties are assumed to be in India and fees to be in rupees.
- A finalised agreement keeps the exact wording it had when finalised, so later template updates never change a signed document.
- Email addresses are required for both parties because notices are given by email or courier.

## General assumptions printed in the Review pack

- (Mutual NDA, One-way NDA, Freelance services agreement) Both parties are in India, and Indian law governs the agreement. The template is not designed for cross-border work.
- (Mutual NDA, One-way NDA, Freelance services agreement) Each party is an adult individual or a business that can enter into a contract, and the person who signs for it has authority to do so.
- (Mutual NDA, One-way NDA, Freelance services agreement) The agreement is in English, and both parties read and understand English.
- (Mutual NDA, One-way NDA, Freelance services agreement) The parties are happy to sign electronically, or to sign a printed copy and share a scan, unless a lawyer advises otherwise.
- (Mutual NDA, One-way NDA, Freelance services agreement) The wording is generic. It does not cover any special rules for a regulated industry, for personal data, for government clients, or for particular technologies.
- (Mutual NDA, One-way NDA, Freelance services agreement) Stamp duty and the way to pay it depend on the state, and this template does not say what they are.
- (Mutual NDA, One-way NDA) The NDA covers information shared while the parties discuss the Purpose. It does not by itself commit either party to any deal.
- (Mutual NDA, One-way NDA) The NDA does not cover who owns anything the parties create together after signing it.
- (Freelance services agreement) All amounts are in Indian rupees and stated before GST.
- (Freelance services agreement) The freelancer works for others too. The agreement contains no exclusivity and no restriction on working in the same field after the engagement.
- (Freelance services agreement) The agreement covers one engagement with one client. Later projects need a new agreement or a written change.
- (Freelance services agreement) The freelancer is not an employee. If the working relationship starts to look like employment, an employment agreement may be more suitable.

## Drafting notes printed in the Review pack

- **Why there is no non-compete clause** (Freelance services agreement): This template deliberately has no clause that stops the freelancer from working in the same field, or for the client's competitors, after the engagement ends. Restraints of that kind after an engagement are generally not enforceable in India, so including one could mislead the client. The optional clause on not hiring each other's people is different and much narrower. Ask a lawyer whether it suits you.
- **Why the IP clause states duration and territory** (Freelance services agreement): Indian copyright law generally expects an assignment of rights to say how long it lasts and where it applies. If it does not, default rules may apply, which can be shorter or narrower than the parties expect. This template therefore always states both, using "perpetual" and "worldwide" as defaults you can change. Ask a lawyer to confirm the position for your case.
- **Template, not legal advice** (Mutual NDA, One-way NDA, Freelance services agreement): This document is made from a general template. It is not legal advice and it does not take your particular circumstances into account. Have it reviewed by a lawyer who practises in India before you rely on it or sign it.

## Clauses

Each clause shows whether it is required or optional, what the explanation says, and the lawyer prompt printed with it.

### `background` - Background

- Applies to: Mutual NDA, One-way NDA
- Required
- Plain-language explanation: A short explanation of why the agreement exists, so a reader (or a court) can see what the parties were trying to do.
- Why it is here: Background text helps interpret the rest of the agreement if there is ever a disagreement about what the parties intended.
- Lawyer prompt: Check with a lawyer if the relationship is more than a simple information exchange, for example if the parties are also planning a joint venture, an investment or an acquisition.

### `definitions` - Confidential Information and key terms

- Applies to: Mutual NDA, One-way NDA
- Required
- Plain-language explanation: This says what counts as confidential and what does not. Information is protected if it is not public and was shared for the Purpose. Four normal exceptions apply: information that is already public, already known to the recipient, received legitimately from someone else, or worked out independently.
- Why it is here: A clear definition prevents arguments later about whether something was covered. The four exceptions are standard in NDAs because it would be unfair to stop someone using information they already had or that anyone can find.
- Lawyer prompt: Check with a lawyer if the information includes personal data, source code, trade secrets or technical specifications that you consider especially valuable, or if you want a narrower or wider definition than the option you chose.

### `purpose` - Purpose

- Applies to: Mutual NDA, One-way NDA
- Required
- Plain-language explanation: The information may be used only for the reason you wrote down. Nobody has to share anything, and signing this does not commit anyone to doing business together.
- Why it is here: Limiting use to a stated purpose is the heart of an NDA. It also makes clear that talking does not create a deal.
- Lawyer prompt: Check with a lawyer if the purpose may change or grow (for example from a proposal to a full project), or if the Recipient might use the information in a way you have not thought of.

### `obligations` - What the Recipient must do

- Applies to: Mutual NDA, One-way NDA
- Required
- Plain-language explanation: The core promises: keep it secret, take proper care, use it only for the Purpose, copy only what is needed, and say so quickly if something leaks.
- Why it is here: These are the practical duties that make the promise of confidentiality meaningful, written as a short checklist that is easy to follow.
- Lawyer prompt: Check with a lawyer if you need specific security measures (such as encryption, access limits or audits) or if the information is regulated.

### `permitted-disclosures` - Who else may see it

- Applies to: Mutual NDA, One-way NDA
- Required
- Plain-language explanation: The recipient may pass information to the staff and advisers who really need it, as long as they are bound to keep it secret. The recipient is answerable for their mistakes.
- Why it is here: In practice people need to consult colleagues, accountants and lawyers. Allowing that on a need-to-know basis, with responsibility staying with the recipient, is the usual balance.
- Lawyer prompt: Check with a lawyer if the information is very sensitive and you want the Recipient to name or get your approval for each person who sees it.

### `compelled-disclosure` - If the law requires disclosure

- Applies to: Mutual NDA, One-way NDA
- Required
- Plain-language explanation: If a court or authority orders the recipient to hand over information, the recipient may comply, but should warn the discloser first if allowed, share only what is required, and ask for it to be kept confidential.
- Why it is here: No contract can override a legal duty to disclose. This clause makes sure the discloser gets a chance to protect itself.
- Lawyer prompt: Check with a lawyer if either party is regulated (for example a bank, a listed company or a public body) or is likely to receive government requests.

### `term` - How long this lasts

- Applies to: Mutual NDA, One-way NDA
- Required
- Plain-language explanation: The agreement covers a set period for sharing information. Information shared during that period stays protected for a further period you choose after the agreement ends. Either side can end the sharing early by giving notice. Trade secrets can be protected for longer.
- Why it is here: A fixed period for secrecy is easier to enforce and more acceptable to both sides than "forever". Many NDAs use two to five years; trade secrets are treated separately because they are only valuable while secret.
- Lawyer prompt: Check with a lawyer if the information will stay valuable for longer than the period you chose, or if you want secrecy to last indefinitely for some categories.

### `return-destruction` - Returning or destroying information

- Applies to: Mutual NDA, One-way NDA
- Required
- Plain-language explanation: When the discloser asks, or the agreement ends, the recipient gives back or deletes the information and can be asked to confirm that. Copies that the law makes it keep, or that sit in back-ups, stay protected.
- Why it is here: Without a return rule, confidential material can sit on devices indefinitely. The exceptions are practical: nobody can delete a back-up tape or ignore a legal record-keeping rule.
- Lawyer prompt: Check with a lawyer if you need proof of deletion, such as a signed certificate, or if the information includes personal data that has its own legal deletion rules.

### `no-licence` - No ownership or licence

- Applies to: Mutual NDA, One-way NDA
- Required
- Plain-language explanation: Sharing information does not hand over ownership. The recipient may use it only for the Purpose.
- Why it is here: This avoids any argument that sharing an idea or file amounted to giving or licensing it.
- Lawyer prompt: Check with a lawyer if the parties might jointly create new work from the information, because this clause does not say who would own it.

### `no-warranty` - No promises about the information

- Applies to: Mutual NDA, One-way NDA
- Optional, on by default
- Plain-language explanation: The discloser is not guaranteeing that what it shares is correct or complete, and is not responsible for decisions the recipient makes using it.
- Why it is here: Without this, a recipient might later argue that it relied on the information and was harmed by errors in it.
- Lawyer prompt: Check with a lawyer if the information is meant to be relied on, for example in a purchase decision, because then this clause may not be what you want.

### `remedies` - Remedies

- Applies to: Mutual NDA, One-way NDA
- Optional, on by default
- Plain-language explanation: If information is about to be leaked or misused, the discloser may go to court quickly to stop it, rather than only claiming money afterwards.
- Why it is here: Damage from a leak is often hard to measure and impossible to undo, so the usual remedy is an order to stop. Recording that both sides understand this is standard.
- Lawyer prompt: Check with a lawyer if you want the right to recover legal costs, a fixed sum for breach, or if you expect to need urgent orders in a particular place.

### `background` - Background

- Applies to: Freelance services agreement
- Required
- Plain-language explanation: A short statement of who is doing what for whom, so the rest of the agreement has context.
- Why it is here: Background text helps interpret the agreement if there is ever a disagreement about what the parties intended.
- Lawyer prompt: Check with a lawyer if the Freelancer will also be an employee, director or shareholder of the Client, or if the work is for a regulated activity.

### `services` - The services

- Applies to: Freelance services agreement
- Required
- Plain-language explanation: The work is whatever Schedule 1 says it is, and nothing more. Anything extra needs to be agreed through the change process.
- Why it is here: Most freelance disputes start with an unclear scope. Tying the work to a written schedule gives both sides something concrete to point to.
- Lawyer prompt: Check with a lawyer if the scope is large, technical, or regulated, or if you cannot describe the work in a schedule with confidence.

### `deliverables` - Delivery and acceptance

- Applies to: Freelance services agreement
- Required
- Plain-language explanation: Work is handed over, the client has a set time to check it, problems against the agreed scope are fixed free of charge, and a fixed number of feedback rounds is included. Silence or real use counts as acceptance.
- Why it is here: Without a review window and a deemed acceptance rule, a client can leave work unreviewed and delay payment. Without a revision limit, feedback can go on forever.
- Lawyer prompt: Check with a lawyer if the Deliverables need formal testing, if acceptance triggers a large payment, or if you want a different rule from deemed acceptance.

### `fees` - Fees and payment

- Applies to: Freelance services agreement
- Required
- Plain-language explanation: This sets how much the client pays, when, and how GST and TDS are handled. Fees are shown without GST, and the client may deduct TDS as the law requires and must provide the certificate. Late payment can carry interest (if you chose it), and the freelancer may pause work if a bill stays unpaid.
- Why it is here: Clear payment terms are the best protection against late payment. Spelling out GST and TDS avoids the most common arguments about what the invoice amount should be.
- Lawyer prompt: Check with a lawyer or chartered accountant if your GST status, the TDS rate or section that applies to this payment, or the interest rate is uncertain, or if the Client is outside India.

### `expenses` - Expenses

- Applies to: Freelance services agreement
- Required
- Plain-language explanation: Either the client repays pre-approved expenses at cost, or the fee already covers them.
- Why it is here: Surprise expenses are a common source of friction. Requiring approval in advance protects the client; allowing reimbursement protects the freelancer from absorbing costs.
- Lawyer prompt: Check with a lawyer if there will be large expenses, travel, or third-party licences that carry legal terms of their own.

### `changes` - Changes to the scope

- Applies to: Freelance services agreement
- Required
- Plain-language explanation: Changes are fine, but only once both sides agree the price and timing in writing.
- Why it is here: Scope creep is the usual reason freelance projects go over time and budget. A simple written change step keeps it visible and priced.
- Lawyer prompt: Check with a lawyer if you expect the scope to change a lot, in which case a time-and-materials arrangement may suit better than a fixed price.

### `client-responsibilities` - What the Client must provide

- Applies to: Freelance services agreement
- Required
- Plain-language explanation: The client has to supply what is needed and answer in a reasonable time. If the client is slow, deadlines move.
- Why it is here: Projects fail as often because the client is slow as because the freelancer is. This makes both sides responsible for keeping things moving.
- Lawyer prompt: Check with a lawyer if the Client will provide personal data or third-party material that comes with its own legal restrictions.

### `ip` - Intellectual property

- Applies to: Freelance services agreement
- Required
- Plain-language explanation: Who owns the finished work and when. The freelancer keeps ownership of its own tools and earlier work. The client gets its chosen rights (outright ownership or a licence) only once it has paid in full, for the time and places you chose. A portfolio clause says whether the freelancer may show the work.
- Why it is here: Rights tied to full payment protect the freelancer. Stating how long the rights last and where they apply matters because Indian copyright law generally expects an assignment to say so. This template always states them rather than leaving it to default rules.
- Lawyer prompt: Check with a lawyer if the work is a core product of the Client, includes software or designs you may reuse, uses open-source or stock material, or the Client is outside India. Also check the duration and territory you chose; a shorter or narrower grant than the Client expects can cause problems later.

### `confidentiality` - Confidentiality

- Applies to: Freelance services agreement
- Required
- Plain-language explanation: Each side keeps the other's private business information secret and uses it only for this work. The usual exceptions apply, and the duty carries on for a set period after the agreement ends.
- Why it is here: Freelancers see client business information and clients may share their own. A short two-way clause avoids needing a separate NDA for most projects.
- Lawyer prompt: Check with a lawyer if the project involves trade secrets, personal data or other regulated information, in which case a full NDA or data-protection terms may be needed.

### `contractor` - Independent contractor

- Applies to: Freelance services agreement
- Required
- Plain-language explanation: The freelancer runs its own business, controls how the work is done and is not an employee. It can work for others and answers for any subcontractors it uses.
- Why it is here: It keeps the relationship clear for tax and legal purposes. How the parties actually behave matters more than the label, so it should match reality.
- Lawyer prompt: Check with a lawyer if the Freelancer will work full-time for the Client, follow the Client's working hours or instructions closely, or work only for the Client, because that can look like employment whatever this clause says.

### `term` - Term and ending this Agreement

- Applies to: Freelance services agreement
- Required
- Plain-language explanation: How long the agreement lasts and how either side can leave. On leaving, the client pays for work done and any unused advance is refunded.
- Why it is here: A clear exit route with notice and payment for work done protects both sides: the client is not locked in and the freelancer is not left unpaid.
- Lawyer prompt: Check with a lawyer if the project is long, expensive, or depends on a single deliverable at the end, because ending early could then cause more loss than the clause assumes.

### `warranties` - Promises and disclaimer

- Applies to: Freelance services agreement
- Required
- Plain-language explanation: Each side promises the basics: the freelancer will work competently and not copy others' work; the client has the right to give its material. Nobody promises a business result.
- Why it is here: These limited promises are what each side can honestly stand behind. Without a disclaimer about results, a client might expect guarantees that no freelancer can give.
- Lawyer prompt: Check with a lawyer if you want stronger guarantees (for example performance targets or uptime), or if the Deliverables are used in a safety-critical or regulated setting.

### `liability` - Limit of liability

- Applies to: Freelance services agreement
- Required
- Plain-language explanation: Neither side can claim lost profit or similar indirect losses. If you chose a cap, each side's liability to the other is limited to the total fees under the agreement. Fraud, unpaid fees, confidentiality breaches and anything the law does not allow to be limited are not capped.
- Why it is here: A freelancer cannot safely take on liability far greater than the fee it earns. A limit linked to the fees is a widely used, easily understood compromise.
- Lawyer prompt: Check with a lawyer if the Deliverables could cause serious loss if wrong, if the Client asks for a higher cap or no cap, or if you want insurance to match the cap.

### `indemnity` - Cover for third-party claims

- Applies to: Freelance services agreement
- Optional, on by default
- Plain-language explanation: If someone outside the deal sues about copied material, whoever supplied that material covers the other for the cost. It is limited to claims about intellectual property and is subject to the liability limit.
- Why it is here: The party that supplies material is best placed to know whether it has the right to use it, so it makes sense for that party to carry the risk. A short, two-way version is fair and easy to understand.
- Lawyer prompt: Check with a lawyer if either side asks for wider cover (such as all losses or data breaches), or if the Deliverables include material that is likely to be challenged.

### `non-solicit` - Not hiring each other's people

- Applies to: Freelance services agreement
- Optional, off by default
- Plain-language explanation: For a short time, neither side will go after the other's staff who worked on the project. General job adverts and people who approach on their own are fine. It does not stop the freelancer working for other clients.
- Why it is here: Clients invest in a freelancer's team, and freelancers invest in their subcontractors; a short, narrow promise not to poach protects both. It is optional, and off by default, because many freelance projects do not need it.
- Lawyer prompt: Check with a lawyer before including this, particularly the length. Restrictions that go further than protecting the other side's staff may not be enforceable. This template does not offer a clause that stops the Freelancer working in the same field after the engagement.

### `force-majeure` - Events outside anyone's control

- Applies to: Freelance services agreement
- Optional, on by default
- Plain-language explanation: If something truly outside anyone's control stops the work, neither side is blamed. Money already owed is still owed. If it drags on, either side can leave.
- Why it is here: It is fairer to share the risk of events nobody can prevent than to treat them as breaches, and having an exit prevents the agreement being stuck indefinitely.
- Lawyer prompt: Check with a lawyer if the project depends on a specific external risk, such as a supplier or a venue, that you want to name or exclude.

### `disputes` - Governing law and disputes

- Applies to: Mutual NDA, One-way NDA, Freelance services agreement
- Required
- Plain-language explanation: Indian law applies. If there is a disagreement the parties talk first, then (if you chose it) try mediation, then go to the courts of your chosen city or to arbitration. Either side can still ask a court for urgent orders at any time, and work continues on the parts not in dispute.
- Why it is here: Agreeing the steps in advance saves time and cost. Talking first often resolves a dispute; naming one place for court or arbitration avoids a fight about where to sue.
- Lawyer prompt: Check with a lawyer if either party is outside India, if the amounts are large, or if you are unsure whether arbitration or the courts of your city suits you. Arbitration can be quicker and private but has its own costs; the courts may be cheaper for small claims.

### `notices` - Notices

- Applies to: Mutual NDA, One-way NDA, Freelance services agreement
- Required
- Plain-language explanation: Formal notices go by email or courier to the addresses at the top of the agreement, and are treated as received after a short, fixed time.
- Why it is here: Agreeing how and where to send notices removes arguments about whether a notice was received.
- Lawyer prompt: Check with a lawyer if a notice could have serious consequences (such as ending the agreement) and you want a stricter delivery method, or if either party changes address often.

### `assignment` - No transfer without consent

- Applies to: Mutual NDA, One-way NDA, Freelance services agreement
- Required
- Plain-language explanation: Neither side can hand the agreement over to someone else without the other's written agreement.
- Why it is here: Each side chose to deal with the other. This keeps it that way unless both agree otherwise.
- Lawyer prompt: Check with a lawyer if either party may be sold or restructured, or if the Freelancer may need to continue the work through a company.

### `stamp-duty` - Stamp duty

- Applies to: Mutual NDA, One-way NDA, Freelance services agreement
- Optional, on by default
- Plain-language explanation: Agreements in India are often subject to stamp duty, which depends on the state. This clause records that the parties will get the document stamped properly and who pays.
- Why it is here: A document that should have been stamped may not be accepted as evidence in court until the duty (and any penalty) is paid. Agreeing who pays up front avoids an argument later. This template cannot tell you the amount or the method for your state.
- Lawyer prompt: Check with a lawyer or your state's stamp office, because the rules, amounts and methods (e-stamping or stamp paper) differ between states and may depend on the type of document.

### `entire-agreement` - Whole agreement

- Applies to: Mutual NDA, One-way NDA, Freelance services agreement
- Required
- Plain-language explanation: What is written here is the deal. Earlier emails, calls and proposals no longer count unless they are in this document.
- Why it is here: It stops either side relying on something said earlier that is not in the signed text.
- Lawyer prompt: Check with a lawyer if there are earlier agreements, proposals or promises that you want to keep in force.

### `amendments` - Changes and waiver

- Applies to: Mutual NDA, One-way NDA, Freelance services agreement
- Required
- Plain-language explanation: The agreement can be changed only in writing that both sides agree to. Not insisting on a right immediately does not lose it.
- Why it is here: It prevents arguments about informal changes and stops one side claiming the other gave up a right by staying quiet.
- Lawyer prompt: Check with a lawyer if you expect to make informal changes often and want to keep a clear record of them.

### `severability` - If part is unenforceable

- Applies to: Mutual NDA, One-way NDA, Freelance services agreement
- Required
- Plain-language explanation: If one part turns out to be invalid, the rest of the agreement still works.
- Why it is here: Standard protection so that a problem with one clause does not undo the whole agreement.
- Lawyer prompt: Check with a lawyer if one clause is so central that the agreement would make no sense without it.

### `counterparts` - Counterparts and electronic signature

- Applies to: Mutual NDA, One-way NDA, Freelance services agreement
- Required
- Plain-language explanation: The parties may sign separate copies and may sign electronically or send a scan. Whoever signs confirms they have the authority.
- Why it is here: It lets people in different places sign without printing and posting documents, and puts the authority question on record.
- Lawyer prompt: Check with a lawyer if the document must be signed on stamp paper, witnessed, notarised or registered, because electronic signatures may not be enough on their own.

## Choices and their defaults

| Id | Choice | Applies to | Default | Options |
|---|---|---|---|---|
| `confidentialScope` | What counts as confidential | Mutual NDA, One-way NDA | broad | `broad`: All non-public information shared for the Purpose is protected, marked or not, if a reasonable person would see it as confidential.<br>`marked`: Only information marked as confidential (or confirmed in writing after being shared orally) is protected. |
| `tradeSecrets` | Trade secrets | Mutual NDA, One-way NDA | protected | `protected`: Trade secrets stay protected for as long as they remain trade secrets, beyond the normal period.<br>`none`: All information, including trade secrets, is protected only for the period you chose. |
| `term` | How long the agreement runs | Freelance services agreement | until-complete | `until-complete`: The agreement ends when the Services are completed and paid for.<br>`fixed`: The agreement ends on a fixed date unless ended earlier or extended in writing.<br>`ongoing`: The agreement has no end date and continues until one party gives notice. |
| `feeModel` | How the freelancer is paid | Freelance services agreement | none (must be chosen) | `fixed`: A single fixed fee, optionally with an advance.<br>`milestones`: The fee is split into milestones, each invoiced when reached.<br>`hourly`: Paid by the hour for time worked, invoiced monthly.<br>`retainer`: A fixed monthly fee, invoiced at the start of each month. |
| `gst` | GST | Freelance services agreement | exclusive | `exclusive`: Fees are stated without GST; GST is added where the Freelancer must charge it.<br>`not-registered`: The Freelancer is not registered for GST; GST is added later only if registration becomes necessary. |
| `latePayment` | Interest on late payment | Freelance services agreement | none | `none`: No interest is charged on late payments.<br>`interest`: Simple interest is charged on overdue undisputed amounts. |
| `expenses` | Expenses | Freelance services agreement | pre-approved | `pre-approved`: The Client repays expenses at cost if it approved them in writing beforehand.<br>`included`: The fee covers all expenses; none can be added without agreement. |
| `ip` | Who owns the finished work | Freelance services agreement | assign | `assign`: On full payment the Freelancer assigns the intellectual property in each Deliverable to the Client.<br>`licence`: On full payment the Client receives a licence to use each Deliverable; the Freelancer keeps ownership. |
| `licenceExclusivity` | Licence type | Freelance services agreement | non-exclusive | `non-exclusive`: The licence is non-exclusive, so the Freelancer may reuse the work.<br>`exclusive`: The licence is exclusive, so the Freelancer will not use or license the work to anyone else during the licence. |
| `ipDuration` | How long the client's rights last | Freelance services agreement | perpetual | `perpetual`: The rights last for the full period for which they exist.<br>`fixed-years`: The rights last for a fixed number of years and then return to the Freelancer. |
| `ipTerritory` | Where the client's rights apply | Freelance services agreement | worldwide | `worldwide`: The rights apply in every country in the world.<br>`india`: The rights apply in India only. |
| `portfolio` | Showing the work in the freelancer's portfolio | Freelance services agreement | allowed | `allowed`: The Freelancer may show the non-confidential work in its portfolio and name the Client unless the Client objects.<br>`not-allowed`: The Freelancer may not show the work or name the Client without written permission. |
| `liabilityCap` | Limit on how much either side can owe the other | Freelance services agreement | fees-paid | `fees-paid`: Each party's total liability is capped at the total fees paid and payable under the agreement.<br>`none`: There is no cap on liability (indirect and consequential loss is still excluded). |
| `mediation` | Mediation before court or arbitration | Freelance services agreement | no | `no`: Disputes go from talks straight to court or arbitration.<br>`yes`: Disputes go from talks to mediation, then to court or arbitration. |
| `disputeMethod` | If talks fail | Mutual NDA, One-way NDA, Freelance services agreement | courts | `courts`: Unresolved disputes go to the courts at the chosen city.<br>`arbitration`: Unresolved disputes go to arbitration under the Arbitration and Conciliation Act 1996. |
| `arbitrators` | Number of arbitrators | Mutual NDA, One-way NDA, Freelance services agreement | one | `one`: A single arbitrator decides the dispute.<br>`three`: A tribunal of three arbitrators decides the dispute. |
| `stampCost` | Who pays the stamp duty | Mutual NDA, One-way NDA, Freelance services agreement | equally | `equally`: Both parties share the stamp duty equally.<br>`a-pays`: The {{a}} pays the stamp duty.<br>`b-pays`: The {{b}} pays the stamp duty. |

## Numbers, dates and text with their defaults

| Id | Setting | Applies to | Default | Allowed range |
|---|---|---|---|---|
| `purpose` | Purpose of sharing the information | Mutual NDA, One-way NDA | none (must be entered) |  |
| `termMonths` | How long information can be shared | Mutual NDA, One-way NDA | 24 | 1 to 120 months |
| `markingDays` | Days to confirm spoken information in writing | Mutual NDA, One-way NDA | 15 | 1 to 90 days |
| `returnDays` | Days to return or destroy information | Mutual NDA, One-way NDA | 15 | 1 to 90 days |
| `confidentialityYears` | How long secrecy lasts after the agreement ends | Mutual NDA, One-way NDA, Freelance services agreement | Mutual NDA: 3; One-way NDA: 3; Freelance services agreement: 2 | 1 to 20 years |
| `terminationNoticeDays` | Notice needed to end the agreement | Mutual NDA, One-way NDA, Freelance services agreement | Mutual NDA: 30; One-way NDA: 30; Freelance services agreement: 14 | 1 to 180 days |
| `talksDays` | Days of talks before a dispute goes further | Mutual NDA, One-way NDA, Freelance services agreement | 15 | 1 to 90 days |
| `mediationDays` | Days allowed for mediation | Freelance services agreement | 30 | 1 to 180 days |
| `arbitrationSeat` | City where arbitration takes place (the seat) | Mutual NDA, One-way NDA, Freelance services agreement | the jurisdiction city |  |
| `servicesDescription` | Services | Freelance services agreement | none (must be entered) |  |
| `deliverables` | Deliverables | Freelance services agreement | none (must be entered) |  |
| `endDate` | End date | Freelance services agreement | none (must be entered) |  |
| `acceptanceDays` | Days for the client to review a deliverable | Freelance services agreement | 7 | 1 to 60 days |
| `revisionRounds` | Rounds of revisions included | Freelance services agreement | 2 | 0 to 20 rounds |
| `fixedFee` | Fixed fee (INR) | Freelance services agreement | none (must be entered) | 1 to  |
| `advancePercent` | Advance on a fixed fee (percent) | Freelance services agreement | 0 | 0 to 100 percent |
| `hourlyRate` | Hourly rate (INR) | Freelance services agreement | none (must be entered) | 1 to  |
| `estimatedHours` | Estimated hours (optional) | Freelance services agreement | none (must be entered) | 1 to  hours |
| `retainerFee` | Monthly retainer (INR) | Freelance services agreement | none (must be entered) | 1 to  |
| `retainerHours` | Hours covered each month (optional) | Freelance services agreement | none (must be entered) | 1 to  hours |
| `paymentDays` | Days to pay an invoice | Freelance services agreement | 15 | 0 to 90 days |
| `lateInterestPercent` | Late payment interest (percent per month) | Freelance services agreement | 1.5 | 0.1 to 5 percent |
| `pauseAfterDays` | Days overdue before work may be paused | Freelance services agreement | 15 | 1 to 90 days |
| `invoiceDisputeDays` | Days to raise a problem with an invoice | Freelance services agreement | 7 | 1 to 60 days |
| `changeResponseDays` | Days to respond to a change request | Freelance services agreement | 5 | 1 to 30 days |
| `feedbackDays` | Days for the client to give feedback | Freelance services agreement | 5 | 1 to 30 days |
| `ipYears` | Years the rights last | Freelance services agreement | 10 | 1 to 60 years |
| `cureDays` | Days to fix a serious breach | Freelance services agreement | 7 | 1 to 60 days |
| `nonSolicitMonths` | Months not to hire each other's people | Freelance services agreement | 12 | 1 to 24 months |
| `forceMajeureDays` | Days before either side can leave after an outside event | Freelance services agreement | 30 | 1 to 180 days |

## Questions the Review pack puts to the lawyer

Shown only when the choices made make them relevant.

- **Governing law and place**: This template is governed by the laws of India and names {{city}}, {{state}} for the courts. Is that right for both parties, for example are both based in India, and is {{city}} the right place?
- **Courts**: Disputes that talks do not settle go to the courts at {{city}}, {{state}}. Are those courts suitable for the likely size and kind of dispute?
- **Arbitration**: Disputes go to arbitration seated in {{arbitrationSeat}} under the Arbitration and Conciliation Act 1996. Number of arbitrators: {{arbitrators}}. The jurisdiction city you entered is {{city}}; if the seat is a different place, is that intended? Is arbitration worth its cost for the likely size of dispute, and should the agreement name an arbitration institution or its rules?
- **Stamp duty**: What stamp duty applies to this document in {{state}}, and should it be stamped using e-stamping or stamp paper? Stamp duty split chosen: {{stampCost}}. Is that the right split?
- **Stamp duty (clause left out)**: You left out the stamp duty clause. Does {{state}} require this document to be stamped, and what happens if it is not?
- **Signing**: Is signing electronically, or signing a printed copy and exchanging scans, enough for this document, or does it need to be signed on stamp paper, witnessed, notarised or registered?
- **Who signs**: Are the people signing authorised to bind each party (for example a director with a board resolution, a partner, or the owner of a sole proprietorship)?
- **Personal data**: Will either party handle personal data (for example customer details) under this agreement? If so, does it need data-protection terms beyond what this template contains?
- **One-way or mutual**: This NDA protects only the Disclosing Party. Will the Receiving Party also share confidential information? If so, a mutual NDA may be better.
- **Mutual or one-way**: This NDA binds both parties equally. If only one side will really share information, is a one-way NDA a better fit?
- **What counts as confidential**: The agreement protects everything non-public that is shared for the Purpose, whether or not it is marked. Is that too wide for your situation, and will the other side accept it?
- **What counts as confidential**: Only information marked as confidential (or confirmed in writing within {{markingDays}} when shared orally) is protected. Is that practical, and what is the risk of information being missed because someone forgot to mark it?
- **Purpose**: The purpose is "{{purpose}}". Is it described in a way that is specific enough to limit use, but wide enough for what the parties will really do?
- **How long secrecy lasts**: The sharing period is {{termMonths}} and secrecy continues for {{confidentialityYears}} after the agreement ends. Is that long enough for the value of the information? Is a fixed period acceptable, or should some information stay secret indefinitely?
- **Trade secrets**: Trade secrets stay protected for as long as they remain secret. Is the wording enough for the kind of information you will share (for example source code or formulae)?
- **Trade secrets**: Trade secrets are protected for the same period as everything else. Is that acceptable, given that protection ends when the period ends?
- **Remedies**: Should the agreement say more about remedies for a leak, for example recovery of legal costs, or a named court for urgent injunctions?
- **Scope and deliverables**: Are the services and deliverables in Schedule 1 specific enough that both parties would agree whether the work is finished?
- **Fees**: The payment model is "{{feeModel}}". Does the payment timing give the freelancer enough protection if the client stops responding, and is the invoice timetable clear?
- **Advance payment**: No advance has been chosen. Is that acceptable, given the risk of doing work before any payment is received?
- **GST wording**: The agreement says fees exclude GST, which is added where the freelancer must charge it. Please confirm with a chartered accountant that this matches the freelancer's GST position and that the invoices will comply.
- **GST wording**: The freelancer is described as not registered for GST, with GST added later if registration becomes necessary. Please confirm with a chartered accountant that this is correct, and whether the client should bear that later GST.
- **TDS wording**: The client may deduct tax at source and must give a TDS certificate. Please confirm with a chartered accountant whether TDS applies to this payment and whether the wording is enough.
- **Late payment interest**: Interest on late payment is {{lateInterestPercent}} per month. Is this rate reasonable and enforceable, and is "per month, counted by the day" the clearest way to express it?
- **Pausing work for non-payment**: The freelancer may pause work if an undisputed invoice is {{pauseAfterDays}} overdue. Is the notice mechanism enough, and are there any deadlines the client could say are missed because of a pause?
- **Intellectual property assignment**: Ownership is assigned to the client on full payment, with rights lasting: {{ipDuration}}; and applying: {{ipTerritory}}. Do these match what the client is paying for? Is anything in the work (such as code libraries or templates) something the freelancer should keep outright?
- **Intellectual property licence**: The client receives a licence ({{licenceExclusivity}}) rather than ownership, with rights lasting: {{ipDuration}}; and applying: {{ipTerritory}}. Does that match what the client expects to buy, and is the licence wide enough for how it will use the work?
- **Fixed-term rights**: The client's rights last {{ipYears}} and then return to the freelancer. Is that consistent with how the client will use the work, and with Indian copyright law on the duration of an assignment?
- **Territory**: The rights apply in India only. Will the client use the work outside India, and if so what happens there?
- **Portfolio**: The freelancer may show the work and name the client unless the client objects. Is that acceptable for this client and this kind of work?
- **Limit of liability**: Each party's liability is capped at the total fees under the agreement. Is the cap right for the risk of this project (including whether the freelancer has insurance), and are the exceptions (fraud, unpaid fees, confidentiality) appropriate?
- **Limit of liability**: No cap on liability has been chosen. Is that acceptable to the freelancer given the possible size of a claim, and would insurance cover it?
- **Cover for third-party claims**: Each party covers the other for third-party intellectual property claims about the material it supplied, subject to the liability limit. Is that the right balance for this project?
- **Not hiring each other's people**: Neither party will recruit the other's project staff for {{nonSolicitMonths}} after the agreement ends. Is that period and scope reasonable and enforceable?
- **Independent contractor status**: The agreement describes the freelancer as an independent contractor. Does the way the work will really be done (hours, instructions, exclusivity) fit that description?
- **Fixed end date**: The agreement ends on {{endDate}}. What should happen to work that is unfinished or unpaid on that date?
- **Mediation**: Mediation is a step before court or arbitration, with {{mediationDays}} allowed. Is it worth the added time and cost for a payment dispute?
- **Foreign client or currency**: This template assumes both parties are in India and fees are in rupees. If the client is outside India, what changes are needed (currency, tax, export of services, enforcement)?

## Known limits

- Wording is generic: no sector rules, no data-protection terms, no government-client terms, no cross-border terms.
- Cross-references inside the text are typed numbers. In the editable Word file the clause numbers are automatic, so a lawyer who adds or removes a clause must re-check them.
- Signing on stamp paper, witnessing, notarisation and registration are not handled; the document only prompts the question.
- Limitation of liability, indemnity, interest on late payment and deemed acceptance are drafted as reasonable middle positions; each has a lawyer prompt above.
