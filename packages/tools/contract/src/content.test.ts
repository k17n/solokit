import { describe, expect, it } from 'vitest';
import { buildContractDocument, documentText } from './document';
import { LIBRARY } from './library';
import { buildReviewSummary } from './review';
import { makeContract } from './testing';

const MSE_SENTENCE = 'If you are registered as a micro or small enterprise (Udyam), statutory payment-time and interest rules may apply regardless of what you write here; ask your lawyer.';
const allText = () => JSON.stringify([LIBRARY.clauses, LIBRARY.options, LIBRARY.variables, LIBRARY.questions, LIBRARY.notes, LIBRARY.assumptions]);

describe('micro and small enterprise payment rules', () => {
  it('warns in the payment help texts that statutory rules may apply whatever is written', () => {
    expect(LIBRARY.options.find((def) => def.id === 'latePayment')!.help).toContain(MSE_SENTENCE);
    const days = LIBRARY.variables.find((def) => def.id === 'paymentDays')!;
    expect(days.help).toContain(MSE_SENTENCE);
    expect(days.help).toContain('45 days');
  });

  it('puts the question to the lawyer in the review of a services agreement only', () => {
    const topics = (kind: Parameters<typeof makeContract>[0]) => buildReviewSummary(makeContract(kind)).questions.map((question) => question.topic);
    expect(topics('services')).toContain('Micro and small enterprise payment rules');
    expect(topics('nda-mutual')).not.toContain('Micro and small enterprise payment rules');
    const question = buildReviewSummary(makeContract('services')).questions.find((q) => q.topic === 'Micro and small enterprise payment rules')!;
    expect(question.text).toContain('15 days');
  });

  it('describes late interest as simple interest at the rate chosen, without implying it overrides the law', () => {
    const option = LIBRARY.options.find((def) => def.id === 'latePayment')!;
    expect(option.choices.find((choice) => choice.id === 'interest')!.summary).toBe('Simple interest at the rate you choose is charged on overdue undisputed amounts.');
    const rate = LIBRARY.variables.find((def) => def.id === 'lateInterestPercent')!;
    expect(rate.help).toContain('Simple interest at the rate you choose');
    expect(rate.help).toContain('does not override');
  });
});

describe('IP duration wording', () => {
  it('no longer says perpetual or in perpetuity anywhere a user or reader sees it', () => {
    const visible = allText().replace(/"(id|default|is)":"perpetual"/g, '');
    expect(visible).not.toMatch(/perpetu/i);
  });

  it('says the rights last for the full period they exist under applicable law', () => {
    const text = documentText(buildContractDocument(makeContract('services')));
    expect(text).toContain('last for the full period for which those rights exist under applicable law.');
    const option = LIBRARY.options.find((def) => def.id === 'ipDuration')!;
    expect(option.choices[0]!.label).toBe('For the full period the rights exist under applicable law');
    expect(option.choices[0]!.summary).toContain('under applicable law');
  });

  it('asks the lawyer about moral rights and a further signed assignment, for an assignment only', () => {
    const find = (contract: ReturnType<typeof makeContract>) => buildReviewSummary(contract).questions.find((question) => question.topic === 'Moral rights and a further assignment document');
    const assign = find(makeContract('services'));
    expect(assign?.text).toMatch(/moral rights/);
    expect(assign?.text).toMatch(/separate assignment document/);
    expect(find(makeContract('services', { options: { feeModel: 'fixed', ip: 'licence' } }))).toBeUndefined();
  });
});

describe('courts clause', () => {
  it('asks the lawyer whether the chosen city has a connection to the parties or the work', () => {
    const courts = buildReviewSummary(makeContract('nda-mutual')).questions.find((question) => question.topic === 'Courts')!;
    expect(courts.text).toContain('real connection to the parties or the work');
    expect(courts.text).toContain('Mumbai');
  });
  it('says so in the help for the dispute choice', () => {
    expect(LIBRARY.options.find((def) => def.id === 'disputeMethod')!.help).toContain('connection to the parties or the work');
  });
});
