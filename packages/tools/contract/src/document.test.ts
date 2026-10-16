import { describe, expect, it } from 'vitest';
import { ContractRenderError } from './engine';
import { buildContractDocument, documentText, resolveContractDocument, type ContractDocument } from './document';
import { LIBRARY } from './library';
import { CONTRACT_KINDS, type Contract, type ContractKind } from './model';
import { makeContract } from './testing';
import { validateContract } from './validation';

const clause = (doc: ContractDocument, id: string) => {
  const found = doc.clauses.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`No clause ${id}`);
  return found;
};
const textOf = (doc: ContractDocument, id: string) => clause(doc, id).paragraphs.map((p) => [p.text, ...p.items.map((i) => i.text)].join(' ')).join(' ');

describe('buildContractDocument', () => {
  it('builds each kind with numbered clauses and numbered paragraphs', () => {
    for (const kind of CONTRACT_KINDS) {
      const doc = buildContractDocument(makeContract(kind));
      expect(doc.clauses.map((c) => c.number), kind).toEqual(doc.clauses.map((_c, index) => String(index + 1)));
      for (const c of doc.clauses) {
        expect(c.paragraphs.map((p) => p.number)).toEqual(c.paragraphs.map((_p, index) => `${c.number}.${index + 1}`));
        for (const p of c.paragraphs) expect(p.items.map((item) => item.label)).toEqual(p.items.map((_i, index) => `(${String.fromCharCode(97 + index)})`));
      }
    }
  });

  it('leaves no unfilled token, undefined or NaN anywhere in any kind', () => {
    for (const kind of CONTRACT_KINDS) {
      const text = documentText(buildContractDocument(makeContract(kind)));
      expect(text, kind).not.toMatch(/\{\{|\}\}|undefined|NaN|\[object/);
    }
  });

  it('names the parties with their details in the opening and defines their roles', () => {
    const doc = buildContractDocument(makeContract('services'));
    expect(doc.heading).toBe('Freelance Services Agreement');
    expect(doc.introduction).toContain('16 October 2026');
    expect(doc.parties[0]?.text).toContain('Asha Rao Consulting, of 12 Linking Road, Mumbai, Maharashtra, 400050, India, PAN AAPFU0939F');
    expect(doc.parties[0]?.text).toContain('(the "Freelancer");');
    expect(doc.parties[1]?.text).toContain('CIN U12345MH2020PTC123456');
    expect(doc.parties[1]?.text).toMatch(/\(the "Client"\)\.$/);
  });

  it('writes the mutual and one-way NDAs differently', () => {
    const mutual = buildContractDocument(makeContract('nda-mutual'));
    const oneWay = buildContractDocument(makeContract('nda-one-way'));
    expect(mutual.heading).toBe('Mutual Non-Disclosure Agreement');
    expect(oneWay.heading).toBe('Non-Disclosure Agreement');
    expect(textOf(mutual, 'definitions')).toContain('Each Party can be both a Discloser and a Recipient');
    expect(textOf(oneWay, 'definitions')).toContain('"Discloser" means the Disclosing Party');
    expect(textOf(oneWay, 'definitions')).not.toContain('Each Party can be both');
    expect(mutual.parties[0]?.text).toContain('(the "First Party")');
    expect(oneWay.parties[1]?.text).toContain('(the "Receiving Party")');
    expect(oneWay.clauses.map((c) => c.id)).toEqual(mutual.clauses.map((c) => c.id));
  });

  it('includes the four standard exclusions in the NDA', () => {
    const text = textOf(buildContractDocument(makeContract('nda-mutual')), 'definitions');
    expect(text).toContain('is or becomes public');
    expect(text).toContain('already knew');
    expect(text).toContain('lawfully receives from a third party');
    expect(text).toContain('develops independently');
  });

  it('uses the chosen term and survival period in the NDA', () => {
    const doc = buildContractDocument(makeContract('nda-one-way', { variables: { purpose: 'a pilot', termMonths: 12, confidentialityYears: 5 } }));
    expect(textOf(doc, 'term')).toContain('continues for 12 months');
    expect(textOf(doc, 'term')).toContain('continue for 5 years after the date this Agreement ends');
  });

  it('turns the trade-secret paragraph on and off', () => {
    const on = textOf(buildContractDocument(makeContract('nda-mutual')), 'term');
    const off = textOf(buildContractDocument(makeContract('nda-mutual', { options: { tradeSecrets: 'none' } })), 'term');
    expect(on).toContain('trade secret');
    expect(off).not.toContain('trade secret');
  });

  it('switches the definition of confidential information', () => {
    const marked = buildContractDocument(makeContract('nda-mutual', { options: { confidentialScope: 'marked' } }));
    expect(textOf(marked, 'definitions')).toContain('confirmed as confidential in writing within 15 days');
    expect(textOf(buildContractDocument(makeContract('nda-mutual')), 'definitions')).toContain('would reasonably be understood to be confidential');
  });

  it('resolves cross-references to the right numbers, and keeps them right when optional clauses move', () => {
    const base = buildContractDocument(makeContract('services'));
    const ipNumber = clause(base, 'ip').number;
    expect(textOf(base, 'term')).toContain(`Clauses ${clause(base, 'fees').number}, ${ipNumber},`);
    expect(textOf(base, 'services')).toContain(`under clause ${clause(base, 'changes').number}`);

    const withNonSolicit = buildContractDocument(makeContract('services', { clauseOverrides: { 'non-solicit': true } }));
    expect(withNonSolicit.clauses.length).toBe(base.clauses.length + 1);
    const moved = clause(withNonSolicit, 'force-majeure').number;
    expect(Number(moved)).toBe(Number(clause(base, 'force-majeure').number) + 1);
    expect(textOf(withNonSolicit, 'force-majeure')).toContain(`clause ${clause(withNonSolicit, 'term').number}.`);
    // The clause that follows the removed one is numbered from the gap.
    const withoutIndemnity = buildContractDocument(makeContract('services', { clauseOverrides: { indemnity: false } }));
    expect(withoutIndemnity.clauses.map((c) => c.id)).not.toContain('indemnity');
    expect(withoutIndemnity.clauses.map((c) => c.number)).toEqual(withoutIndemnity.clauses.map((_c, i) => String(i + 1)));
    expect(textOf(withoutIndemnity, 'liability')).not.toContain('indemn');
  });

  it('points paragraph references at the numbered paragraph', () => {
    const doc = buildContractDocument(makeContract('nda-mutual'));
    const early = clause(doc, 'term').paragraphs[1];
    expect(early?.number).toBe(`${clause(doc, 'term').number}.2`);
    expect(textOf(doc, 'term')).toContain(`under clause ${early?.number}.`);
    expect(textOf(doc, 'return-destruction')).toContain(`period in clause ${clause(doc, 'term').paragraphs[2]?.number}`);
  });

  it('throws, rather than printing a blank, when something the clauses need is missing', () => {
    expect(() => buildContractDocument(makeContract('nda-mutual', { variables: {} }))).toThrow(ContractRenderError);
    expect(() => buildContractDocument(makeContract('services', { variables: { fixedFee: 1000 } }))).toThrow(expect.objectContaining({ token: 'servicesDescription' })); // used only by Schedule 1, but still required
    expect(() => buildContractDocument(makeContract('services', { options: {} }))).toThrow(expect.objectContaining({ token: 'feeModel' }));
    expect(() => buildContractDocument(makeContract('services', { options: { feeModel: 'hourly' }, variables: { servicesDescription: 'x', deliverables: 'y' } }))).toThrow(expect.objectContaining({ token: 'hourlyRate' }));
    expect(() => buildContractDocument(makeContract('services', { jurisdiction: { city: '', state: 'Goa' } }))).toThrow(ContractRenderError);
  });

  it('ignores a switch-off for a required clause', () => {
    const doc = buildContractDocument(makeContract('services', { clauseOverrides: { fees: false } }));
    expect(doc.clauses.map((c) => c.id)).toContain('fees');
  });
});

describe('services agreement content', () => {
  it('writes fixed fees with the figure and the words, and an optional advance', () => {
    const plain = textOf(buildContractDocument(makeContract('services')), 'fees');
    expect(plain).toContain('fixed fee of INR 1,20,000 (One Lakh Twenty Thousand Rupees Only)');
    expect(plain).toContain('will invoice the fixed fee when the final Deliverable is delivered');
    const advance = textOf(buildContractDocument(makeContract('services', { variables: { ...makeContract('services').variables, fixedFee: 50000, advancePercent: 30 } })), 'fees');
    expect(advance).toContain('30% of the fixed fee as an advance');
  });

  it('writes each fee model', () => {
    const doc = (feeModel: string, variables: Contract['variables'] = {}) => buildContractDocument(makeContract('services', { options: { feeModel }, variables: { ...makeContract('services').variables, ...variables } }));
    expect(textOf(doc('milestones'), 'fees')).toContain('fee for each milestone listed in Schedule 1');
    expect(textOf(doc('hourly'), 'fees')).toContain('INR 1,500 (One Thousand Five Hundred Rupees Only) for each hour');
    expect(textOf(doc('hourly', { estimatedHours: 40 }), 'fees')).toContain('estimate for the Services is 40 hours');
    expect(textOf(doc('hourly'), 'fees')).not.toContain('estimate');
    expect(textOf(doc('retainer', { retainerHours: 20 }), 'fees')).toContain('covers up to 20 hours');
    expect(textOf(doc('retainer'), 'fees')).toContain('monthly retainer of INR 40,000');
  });

  it('puts GST, TDS and late-payment wording in the fees clause', () => {
    const fees = textOf(buildContractDocument(makeContract('services')), 'fees');
    expect(fees).toContain('exclusive of GST');
    expect(fees).toContain('deduct tax at source (TDS)');
    expect(fees).toContain('TDS certificate');
    expect(fees).not.toContain('simple interest');
    const interest = textOf(buildContractDocument(makeContract('services', { options: { feeModel: 'fixed', latePayment: 'interest' } })), 'fees');
    expect(interest).toContain('simple interest on the overdue amount at 1.5% per month');
    const unregistered = textOf(buildContractDocument(makeContract('services', { options: { feeModel: 'fixed', gst: 'not-registered' } })), 'fees');
    expect(unregistered).toContain('not registered for GST');
    expect(unregistered).not.toContain('exclusive of GST');
  });

  it('states the IP duration and territory for an assignment, and lets both be changed', () => {
    const defaults = buildContractDocument(makeContract('services'));
    const ip = textOf(defaults, 'ip');
    expect(ip).toContain('assigns to the Client all copyright and other intellectual property rights');
    expect(ip).toContain('(in perpetuity)');
    expect(ip).toContain('every country in the world');
    expect(ip).toContain('has paid for a Deliverable in full');
    const changed = textOf(buildContractDocument(makeContract('services', { options: { feeModel: 'fixed', ipDuration: 'fixed-years', ipTerritory: 'india' }, variables: { ...makeContract('services').variables, ipYears: 5 } })), 'ip');
    expect(changed).toContain('last for 5 years from the date the Client pays');
    expect(changed).toContain('apply in India only');
    expect(changed).not.toContain('(in perpetuity)');
  });

  it('offers a licence instead of an assignment, exclusive or not', () => {
    const doc = (licenceExclusivity: string) => textOf(buildContractDocument(makeContract('services', { options: { feeModel: 'fixed', ip: 'licence', licenceExclusivity } })), 'ip');
    expect(doc('non-exclusive')).toContain('non-exclusive, non-transferable licence');
    expect(doc('exclusive')).toContain('exclusive, non-transferable licence');
    expect(doc('exclusive')).not.toContain('assigns to the Client');
    expect(doc('non-exclusive')).toContain('keeps ownership');
  });

  it('keeps the freelancer\'s pre-existing materials and an optional portfolio right', () => {
    const ip = textOf(buildContractDocument(makeContract('services')), 'ip');
    expect(ip).toContain('Pre-existing Materials');
    expect(ip).toContain('may describe and show the non-confidential parts');
    const none = textOf(buildContractDocument(makeContract('services', { options: { feeModel: 'fixed', portfolio: 'not-allowed' } })), 'ip');
    expect(none).toContain('will not show the Deliverables');
  });

  it('caps liability at the fees by default and removes the cap on request', () => {
    expect(textOf(buildContractDocument(makeContract('services')), 'liability')).toContain('limited to the total fees paid and payable');
    expect(textOf(buildContractDocument(makeContract('services', { options: { feeModel: 'fixed', liabilityCap: 'none' } })), 'liability')).not.toContain('limited to the total fees');
  });

  it('never offers a non-compete, and the optional non-solicit starts switched off', () => {
    const doc = buildContractDocument(makeContract('services'));
    expect(documentText(doc)).not.toMatch(/non-?compete|compete|competitor|competing/i);
    expect(doc.clauses.map((c) => c.id)).not.toContain('non-solicit');
    const on = buildContractDocument(makeContract('services', { clauseOverrides: { 'non-solicit': true } }));
    expect(textOf(on, 'non-solicit')).toContain('12 months');
    expect(documentText(on)).not.toMatch(/non-?compete|compete|competitor|competing/i);
  });

  it('builds the schedule from the scope, deliverables, timetable and fees', () => {
    const doc = buildContractDocument(makeContract('services'));
    const [schedule] = doc.schedules;
    expect(schedule?.title).toContain('Schedule 1');
    expect(schedule?.sections.map((s) => s.heading)).toEqual(['Part 1 - Services', 'Part 2 - Deliverables', 'Part 3 - Timetable', 'Part 4 - Fees']);
    expect(schedule?.sections[0]?.lines).toEqual(['Design a five-page marketing website', 'Set up the contact form']);
    expect(schedule?.sections[1]?.lines).toEqual(['Figma design files', 'Responsive HTML and CSS']);
    expect(schedule?.sections[2]?.lines).toEqual(['Start date: 16 October 2026.']);
    expect(schedule?.sections[3]?.lines[0]).toContain('Fixed fee: INR 1,20,000');
  });

  it('lists milestones with a total, and a fixed end date', () => {
    const doc = buildContractDocument(makeContract('services', { options: { feeModel: 'milestones', term: 'fixed' } }));
    const sections = doc.schedules[0]!.sections;
    expect(sections[3]?.lines).toContain('Milestone 1: Design approved - INR 40,000 - on approval of the designs.');
    expect(sections[3]?.lines).toContain('Total of the milestones: INR 1,20,000.');
    expect(sections[2]?.lines).toContain('End date: 31 March 2027.');
    expect(textOf(doc, 'term')).toContain('ends on 31 March 2027');
  });

  it('has no schedule for an NDA', () => {
    expect(buildContractDocument(makeContract('nda-mutual')).schedules).toEqual([]);
  });
});

describe('disputes', () => {
  const disputes = (overrides: Partial<Contract>) => textOf(buildContractDocument(makeContract('services', overrides)), 'disputes');

  it('goes talks, then the courts of the chosen city', () => {
    const text = disputes({});
    expect(text).toContain('governed by the laws of India');
    expect(text).toContain('discussion between their signatories (or people they name) for 15 days');
    expect(text).toContain('courts at Mumbai, Maharashtra have exclusive jurisdiction');
    expect(text).not.toContain('mediation');
    expect(text).not.toContain('Arbitration and Conciliation Act');
  });

  it('adds mediation when chosen', () => {
    const text = disputes({ options: { feeModel: 'fixed', mediation: 'yes' } });
    expect(text).toContain('refer it to mediation');
    expect(text).toContain('within 30 days of the referral');
  });

  it('offers arbitration under the Arbitration and Conciliation Act 1996, with the seat and number of arbitrators', () => {
    const one = disputes({ options: { feeModel: 'fixed', disputeMethod: 'arbitration' } });
    expect(one).toContain('Arbitration and Conciliation Act 1996');
    expect(one).toContain('seat and place of arbitration is Mumbai');
    expect(one).toContain('single arbitrator');
    expect(one).not.toContain('have exclusive jurisdiction over it');
    const three = disputes({ options: { feeModel: 'fixed', disputeMethod: 'arbitration', arbitrators: 'three' }, variables: { ...makeContract('services').variables, arbitrationSeat: 'Bengaluru' } });
    expect(three).toContain('three arbitrators');
    expect(three).toContain('seat and place of arbitration is Bengaluru');
    expect(three).toContain('courts at Bengaluru have exclusive jurisdiction');
  });

  it('works for an NDA too', () => {
    const nda = textOf(buildContractDocument(makeContract('nda-one-way', { options: { disputeMethod: 'arbitration' } })), 'disputes');
    expect(nda).toContain('Arbitration and Conciliation Act 1996');
  });
});

describe('signature blocks and notice', () => {
  it('has a block for each party with the signatory and a place', () => {
    const doc = buildContractDocument(makeContract('services', { placeOfSigning: 'Mumbai' }));
    expect(doc.signatures).toHaveLength(2);
    expect(doc.signatures[0]).toEqual({
      heading: 'Signed for and on behalf of Asha Rao Consulting (the Freelancer)',
      signatoryName: 'Asha Rao',
      signatoryTitle: 'Proprietor',
      place: 'Mumbai',
    });
    expect(doc.signatures[1]?.signatoryTitle).toBe('Director');
  });
  it('carries the template notice', () => {
    expect(buildContractDocument(makeContract('nda-mutual')).notice).toMatch(/not legal advice/i);
  });
});

describe('every combination of options builds', () => {
  const kinds: ContractKind[] = ['nda-mutual', 'nda-one-way', 'services'];

  it('builds and validates with each option switched to each of its choices, one at a time', () => {
    for (const kind of kinds) {
      for (const option of LIBRARY.options.filter((def) => def.kinds.includes(kind))) {
        for (const choice of option.choices.filter((c) => !c.kinds || c.kinds.includes(kind))) {
          const base = makeContract(kind);
          // Switch the parent options on, so that dependent options are visible too.
          const parents = { ip: option.id === 'licenceExclusivity' ? 'licence' : 'assign', disputeMethod: option.id === 'arbitrators' ? 'arbitration' : 'courts' };
          const contract = { ...base, options: { ...base.options, ...(kind === 'services' ? parents : { disputeMethod: parents.disputeMethod }), [option.id]: choice.id } };
          const where = `${kind}: ${option.id}=${choice.id}`;
          expect(validateContract(contract), where).toEqual([]);
          const text = documentText(buildContractDocument(contract));
          expect(text, where).not.toMatch(/\{\{|undefined|NaN/);
        }
      }
    }
  });

  it('builds with every optional clause switched on and off, and random mixes of options', () => {
    let seed = 20261016;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let round = 0; round < 150; round++) {
      const kind = kinds[Math.floor(random() * kinds.length)] as ContractKind;
      const base = makeContract(kind);
      const options: Record<string, string> = {};
      for (const def of LIBRARY.options.filter((candidate) => candidate.kinds.includes(kind))) {
        const choices = def.choices.filter((choice) => !choice.kinds || choice.kinds.includes(kind));
        options[def.id] = (choices[Math.floor(random() * choices.length)] as { id: string }).id;
      }
      const clauseOverrides: Record<string, boolean> = {};
      for (const clauseDef of LIBRARY.clauses.filter((candidate) => candidate.kinds.includes(kind) && !candidate.required)) clauseOverrides[clauseDef.id] = random() < 0.5;
      const contract: Contract = { ...base, options, clauseOverrides };
      const where = `${kind} ${JSON.stringify({ options, clauseOverrides })}`;
      expect(validateContract(contract), where).toEqual([]);
      const doc = buildContractDocument(contract);
      expect(documentText(doc), where).not.toMatch(/\{\{|undefined|NaN/);
      expect(doc.clauses.map((c) => c.number)).toEqual(doc.clauses.map((_c, i) => String(i + 1)));
    }
  });
});

describe('resolveContractDocument', () => {
  it('returns the frozen wording for a final contract, and builds a draft', () => {
    const draft = makeContract('nda-mutual');
    const frozen = { ...buildContractDocument(draft), heading: 'Frozen heading' };
    expect(resolveContractDocument({ ...draft, status: 'final', finalDocument: frozen }).heading).toBe('Frozen heading');
    expect(resolveContractDocument({ ...draft, finalDocument: frozen }).heading).toBe('Mutual Non-Disclosure Agreement');
  });
});
