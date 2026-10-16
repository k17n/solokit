import { describe, expect, it } from 'vitest';
import { buildContractDocument } from './document';
import { buildReviewPack, buildReviewSummary, reviewText } from './review';
import { makeContract } from './testing';

describe('buildReviewSummary', () => {
  it('opens with a clear template-not-legal-advice notice', () => {
    for (const kind of ['nda-mutual', 'nda-one-way', 'services'] as const) {
      const summary = buildReviewSummary(makeContract(kind));
      expect(summary.notice).toMatch(/^Template, not legal advice\./);
      expect(summary.notice).toMatch(/lawyer who practises in India/);
      expect(summary.notes.map((note) => note.title)).toContain('Template, not legal advice');
    }
  });

  it('explains every clause in the agreement, with its number, in order', () => {
    const contract = makeContract('services', { clauseOverrides: { indemnity: false } });
    const doc = buildContractDocument(contract);
    const summary = buildReviewSummary(contract);
    expect(summary.clauses.map((c) => `${c.number} ${c.title}`)).toEqual(doc.clauses.map((c) => `${c.number} ${c.title}`));
    for (const clause of summary.clauses) {
      expect(clause.explanation.length, clause.title).toBeGreaterThan(40);
      expect(clause.rationale.length).toBeGreaterThan(40);
      expect(clause.risk).toMatch(/^Check with a lawyer/);
    }
  });

  it('lists the choices made, in plain words, with the clause they belong to', () => {
    const summary = buildReviewSummary(makeContract('services', { options: { feeModel: 'fixed', ip: 'licence', licenceExclusivity: 'exclusive', ipTerritory: 'india' } }));
    const byLabel = (label: string) => summary.choices.find((choice) => choice.label === label);
    expect(byLabel('Who owns the finished work')?.value).toMatch(/receives a licence/);
    expect(byLabel('Licence type')?.value).toMatch(/exclusive/);
    expect(byLabel('Where the client\'s rights apply')?.value).toBe('The rights apply in India only.');
    expect(byLabel('Fixed fee (INR)')?.value).toBe('INR 1,20,000');
    const ipClause = summary.clauses.find((clause) => clause.title === 'Intellectual property');
    expect(byLabel('Who owns the finished work')?.clauseNumber).toBe(ipClause?.number);
  });

  it('flags settings still at the template default, and not the ones the user set', () => {
    const summary = buildReviewSummary(makeContract('services', { variables: { ...makeContract('services').variables, paymentDays: 30 } }));
    const flagged = summary.defaultsUnchanged.map((choice) => choice.label);
    expect(flagged).toContain('Days for the client to review a deliverable');
    expect(flagged).toContain('Where the client\'s rights apply');
    expect(flagged).not.toContain('Days to pay an invoice');
    // The fee and the scope have no default, so they are never flagged.
    expect(flagged).not.toContain('Fixed fee (INR)');
    expect(flagged).not.toContain('Services');
    expect(flagged).not.toContain('How the freelancer is paid');
  });

  it('shows milestones among the choices', () => {
    const summary = buildReviewSummary(makeContract('services', { options: { feeModel: 'milestones' } }));
    expect(summary.choices.map((choice) => choice.label)).toEqual(expect.arrayContaining(['Milestone 1', 'Milestone 2']));
  });

  it('reports which optional clauses are in and out', () => {
    const summary = buildReviewSummary(makeContract('services', { clauseOverrides: { indemnity: false, 'non-solicit': true } }));
    const state = Object.fromEntries(summary.optionalClauses.map((c) => [c.title, c.included]));
    expect(state['Cover for third-party claims']).toBe(false);
    expect(state['Not hiring each other\'s people']).toBe(true);
    expect(summary.optionalClauses.find((c) => c.title === 'Not hiring each other\'s people')?.onByDefault).toBe(false);
    expect(summary.optionalClauses.find((c) => c.title === 'Not hiring each other\'s people')?.clauseNumber).toBeDefined();
    expect(summary.optionalClauses.find((c) => c.title === 'Cover for third-party claims')?.clauseNumber).toBeUndefined();
  });

  it('computes key dates for an NDA', () => {
    const dates = Object.fromEntries(buildReviewSummary(makeContract('nda-mutual')).keyDates.map((d) => [d.label, d]));
    expect(dates['Effective date']?.value).toBe('16 October 2026');
    expect(dates['Information can be shared until']?.value).toBe('16 October 2028');
    expect(dates['Secrecy duties run until at least']?.value).toBe('16 October 2031');
    expect(dates['Secrecy duties run until at least']?.note).toMatch(/trade secrets/i);
    expect(dates['Notice to end early']?.value).toBe('30 days');
  });

  it('computes key dates for a services agreement, including a fixed end date', () => {
    const dates = Object.fromEntries(buildReviewSummary(makeContract('services', { options: { feeModel: 'fixed', term: 'fixed' } })).keyDates.map((d) => [d.label, d]));
    expect(dates['Agreement ends']?.value).toBe('31 March 2027');
    expect(dates['Confidentiality continues until']?.value).toBe('31 March 2029');
    expect(dates['Invoices are due']?.value).toBe('15 days after the client receives them');
    expect(dates['Notice to end early']?.value).toBe('14 days');
    const open = Object.fromEntries(buildReviewSummary(makeContract('services')).keyDates.map((d) => [d.label, d]));
    expect(open['Agreement ends']?.value).toBe('When the Services are completed and paid for');
    expect(open['Confidentiality continues for']?.value).toBe('2 years after the agreement ends');
  });

  it('derives questions for the lawyer from the options chosen', () => {
    const text = (contract: ReturnType<typeof makeContract>) => buildReviewSummary(contract).questions.map((q) => `${q.topic}: ${q.text}`).join('\n');

    const defaults = text(makeContract('services'));
    expect(defaults).toContain('Intellectual property assignment');
    expect(defaults).toContain('Perpetual (for as long as the rights exist)');
    expect(defaults).toContain('Worldwide');
    expect(defaults).toContain('Limit of liability');
    expect(defaults).toContain('capped at the total fees');
    expect(defaults).toContain('Stamp duty');
    expect(defaults).toContain('Maharashtra');
    expect(defaults).toContain('TDS wording');
    expect(defaults).toContain('GST wording');
    expect(defaults).toContain('Advance payment');
    expect(defaults).not.toContain('Arbitration');

    const arbitration = text(makeContract('services', { options: { feeModel: 'fixed', disputeMethod: 'arbitration', arbitrators: 'three', liabilityCap: 'none', ip: 'licence' } }));
    expect(arbitration).toContain('Arbitration: Disputes go to arbitration seated in Mumbai');
    expect(arbitration).toContain('Number of arbitrators: Three arbitrators');
    expect(arbitration).toContain('No cap on liability');
    expect(arbitration).toContain('Intellectual property licence');
    expect(arbitration).not.toContain('Intellectual property assignment');

    const left = text(makeContract('services', { clauseOverrides: { 'stamp-duty': false, 'non-solicit': true } }));
    expect(left).toContain('Stamp duty (clause left out)');
    expect(left).toContain('Not hiring each other');
  });

  it('asks NDA-specific questions', () => {
    const oneWay = buildReviewSummary(makeContract('nda-one-way')).questions.map((q) => q.topic);
    expect(oneWay).toContain('One-way or mutual');
    expect(oneWay).toContain('How long secrecy lasts');
    expect(oneWay).toContain('Trade secrets');
    expect(buildReviewSummary(makeContract('nda-mutual')).questions.map((q) => q.topic)).toContain('Mutual or one-way');
  });

  it('has no unfilled tokens anywhere', () => {
    for (const kind of ['nda-mutual', 'nda-one-way', 'services'] as const) {
      expect(reviewText(buildReviewSummary(makeContract(kind)))).not.toMatch(/\{\{|undefined|NaN/);
    }
  });

  it('marks stamp duty as something to verify, with no amounts', () => {
    const { stampDuty } = buildReviewSummary(makeContract('services'));
    expect(stampDuty.state).toBe('Maharashtra');
    expect(stampDuty.text).toMatch(/^Verify for Maharashtra/);
    expect(stampDuty.text).not.toMatch(/₹|Rs|INR|%|per cent/);
    expect(stampDuty.text.replace('2026-10-16', '')).not.toMatch(/\d/);
    expect(stampDuty.asOf).toBe('2026-10-16');
  });

  it('states the assumptions for the kind', () => {
    const services = buildReviewSummary(makeContract('services')).assumptions.join('\n');
    expect(services).toContain('Both parties are in India');
    expect(services).toContain('no restriction on working in the same field');
    expect(buildReviewSummary(makeContract('nda-mutual')).assumptions.join('\n')).not.toContain('freelancer');
  });

  it('explains why there is no non-compete', () => {
    const note = buildReviewSummary(makeContract('services')).notes.find((n) => n.title.includes('non-compete'));
    expect(note?.body).toMatch(/generally not enforceable in India/);
    expect(buildReviewSummary(makeContract('nda-mutual')).notes.some((n) => n.title.includes('non-compete'))).toBe(false);
  });

  it('records the library version', () => {
    expect(buildReviewSummary(makeContract('services')).libraryVersion).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});

describe('buildReviewPack', () => {
  it('returns the agreement and its summary, numbered consistently', () => {
    const pack = buildReviewPack(makeContract('services'));
    expect(pack.document.clauses.length).toBe(pack.summary.clauses.length);
    expect(pack.summary.heading).toBe(pack.document.heading);
  });

  it('uses the frozen wording of a final contract', () => {
    const draft = makeContract('nda-mutual');
    const frozen = { ...buildContractDocument(draft), heading: 'Frozen' };
    expect(buildReviewPack({ ...draft, status: 'final', finalDocument: frozen }).document.heading).toBe('Frozen');
  });
});
