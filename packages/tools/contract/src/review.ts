import { addMonths, addYears, formatDate, isRealIsoDate } from './dates';
import { documentText, resolveContractDocument, type ContractDocument } from './document';
import { clauseTitle, createContext, evalCondition, isClauseIncluded, optionVisible, partyTerms, renderTemplate, variableDefault, variableVisible } from './engine';
import { formatCount, formatRupees, formatValue } from './format';
import { LIBRARY } from './library';
import type { ContractLibraryShape } from './library-types';
import { KIND_HEADINGS, KIND_LABELS, ROLE_LABELS, type Contract } from './model';
import { stampDutyNote, type StampDutyNote } from './stamp-duty';
import { cleanDeep, unprintableCharacters, unprintableMessage } from './text';

export interface ReviewChoice {
  label: string;
  value: string;
  /** Clause number in this document, when the setting belongs to a clause that is in it. */
  clauseNumber?: string;
  /** True when the value is the template's own default, so the user may not have thought about it. */
  isDefault: boolean;
}

export interface ReviewClause {
  number: string;
  title: string;
  explanation: string;
  rationale: string;
  risk: string;
}

export interface ReviewDate {
  label: string;
  value: string;
  note?: string;
}

export interface ReviewQuestion {
  topic: string;
  text: string;
  clauseNumber?: string;
}

export interface ReviewOptionalClause {
  title: string;
  included: boolean;
  /** Whether the template switches it on by default. */
  onByDefault: boolean;
  clauseNumber?: string;
}

export interface ReviewSummary {
  contractTitle: string;
  heading: string;
  kindLabel: string;
  /** "Template, not legal advice" */
  notice: string;
  parties: { role: string; name: string }[];
  effectiveDate: string;
  jurisdiction: string;
  choices: ReviewChoice[];
  defaultsUnchanged: ReviewChoice[];
  optionalClauses: ReviewOptionalClause[];
  assumptions: string[];
  keyDates: ReviewDate[];
  clauses: ReviewClause[];
  questions: ReviewQuestion[];
  notes: { title: string; body: string }[];
  stampDuty: StampDutyNote;
  /** The template wording version the agreement's text was written under. */
  libraryVersion: string;
  /** Things that do not stop the agreement but are worth knowing, such as characters the PDF fonts cannot print. */
  warnings: string[];
  /** Present when the explanations below come from a newer template than the one the agreement's wording was frozen under. */
  frozenNote?: string;
}

export interface ReviewPack {
  document: ContractDocument;
  summary: ReviewSummary;
}

export const REVIEW_NOTICE =
  'Template, not legal advice. This document was made from a general template and does not take your particular circumstances into account. Have a lawyer who practises in India review it before you sign it. The questions below are suggestions to start that conversation, not a complete list.';

function keyDates(contract: Contract, ctx: ReturnType<typeof createContext>): ReviewDate[] {
  const dates: ReviewDate[] = [{ label: 'Effective date', value: formatDate(contract.effectiveDate) }];
  const effective = contract.effectiveDate;
  const number = (id: string): number | undefined => (typeof ctx.values[id] === 'number' ? (ctx.values[id] as number) : undefined);
  const noticeDays = number('terminationNoticeDays');
  const secrecyYears = number('confidentialityYears');
  if (!isRealIsoDate(effective)) return dates;

  if (contract.kind === 'services') {
    const fixedEnd = ctx.choices['term'] === 'fixed' && typeof ctx.values['endDate'] === 'string' ? String(ctx.values['endDate']) : undefined;
    if (fixedEnd) dates.push({ label: 'Agreement ends', value: formatDate(fixedEnd), note: 'Unless ended earlier or extended in writing.' });
    else dates.push({ label: 'Agreement ends', value: ctx.choices['term'] === 'ongoing' ? 'No fixed end date' : 'When the Services are completed and paid for' });
    const paymentDays = number('paymentDays');
    if (paymentDays !== undefined) dates.push({ label: 'Invoices are due', value: `${formatCount(paymentDays, 'days')} after the client receives them` });
    const acceptance = number('acceptanceDays');
    if (acceptance !== undefined) dates.push({ label: 'Client review period', value: `${formatCount(acceptance, 'days')} after each delivery` });
    if (noticeDays !== undefined) dates.push({ label: 'Notice to end early', value: formatCount(noticeDays, 'days') });
    if (secrecyYears !== undefined) {
      dates.push(
        fixedEnd
          ? { label: 'Confidentiality continues until', value: formatDate(addYears(fixedEnd, secrecyYears)), note: `${formatCount(secrecyYears, 'years')} after the agreement ends on its fixed date.` }
          : { label: 'Confidentiality continues for', value: `${formatCount(secrecyYears, 'years')} after the agreement ends` },
      );
    }
    const ipYears = number('ipYears');
    if (ctx.choices['ipDuration'] === 'fixed-years' && ipYears !== undefined) {
      dates.push({ label: 'Client\'s rights last', value: `${formatCount(ipYears, 'years')} from full payment for each Deliverable` });
    }
    return dates;
  }

  const termMonths = number('termMonths');
  if (termMonths !== undefined) {
    const end = addMonths(effective, termMonths);
    dates.push({ label: 'Information can be shared until', value: formatDate(end), note: `${formatCount(termMonths, 'months')} from the effective date, unless ended earlier.` });
    if (secrecyYears !== undefined) {
      dates.push({
        label: 'Secrecy duties run until at least',
        value: formatDate(addYears(end, secrecyYears)),
        note: `For information shared on the last day. If the agreement ends earlier, the ${formatCount(secrecyYears, 'years')} count from that earlier date.${
          ctx.choices['tradeSecrets'] === 'protected' ? ' Trade secrets stay protected for as long as they remain secret.' : ''
        }`,
      });
    }
  }
  if (noticeDays !== undefined) dates.push({ label: 'Notice to end early', value: formatCount(noticeDays, 'days') });
  const returnDays = number('returnDays');
  if (returnDays !== undefined) dates.push({ label: 'Information is returned or destroyed within', value: `${formatCount(returnDays, 'days')} of a request or the end of the agreement` });
  return dates;
}

/**
 * Builds the page a lawyer or the user reads alongside the agreement: what was chosen, what was left at the
 * template default, key dates, a plain-language note for each clause and questions to ask a lawyer.
 * Throws {@link ContractRenderError} if the contract is not complete (validate first).
 */
export function buildReviewSummary(contract: Contract, library: ContractLibraryShape = LIBRARY, document?: ContractDocument): ReviewSummary {
  const doc = document ?? resolveContractDocument(contract, library);
  const ctx = createContext(contract, library);
  const terms = partyTerms(contract.kind);
  const numberOf = new Map(doc.clauses.map((clause) => [clause.id, clause.number]));
  const clauseNumber = (id: string): { clauseNumber?: string } => {
    const found = numberOf.get(id);
    return found ? { clauseNumber: found } : {};
  };

  const choices: ReviewChoice[] = [];
  for (const def of library.options) {
    if (!optionVisible(def, ctx)) continue;
    const choice = def.choices.find((candidate) => candidate.id === ctx.choices[def.id]);
    if (!choice) continue;
    choices.push({
      label: def.label,
      value: choice.summary.replaceAll('{{a}}', terms.a).replaceAll('{{b}}', terms.b),
      ...clauseNumber(def.clauseId),
      isDefault: def.default !== undefined && choice.id === def.default,
    });
  }
  for (const def of library.variables) {
    if (!variableVisible(def, ctx)) continue;
    const value = ctx.values[def.id];
    if (value === undefined) continue;
    const fallback = variableDefault(def, contract);
    const shown = def.type === 'money' ? formatRupees(Number(value)) : formatValue(def, value);
    choices.push({ label: def.label, value: shown, ...clauseNumber(def.clauseIdByKind?.[contract.kind] ?? def.clauseId), isDefault: fallback !== undefined && fallback === value });
  }
  if (contract.kind === 'services' && ctx.choices['feeModel'] === 'milestones') {
    contract.milestones.forEach((milestone, index) => {
      choices.push({ label: `Milestone ${index + 1}`, value: `${milestone.title.trim()}: ${formatRupees(milestone.amount)}, ${milestone.due.trim()}`, ...clauseNumber('fees'), isDefault: false });
    });
  }

  const optionalClauses: ReviewOptionalClause[] = library.clauses
    .filter((clause) => clause.kinds.includes(contract.kind) && !clause.required)
    .map((clause) => ({
      title: clauseTitle(clause, contract.kind),
      included: isClauseIncluded(clause, contract),
      onByDefault: clause.defaultIncluded ?? true,
      ...clauseNumber(clause.id),
    }));

  const refs = new Map<string, string>(numberOf);
  const fill = (text: string) => renderTemplate(text, ctx, refs);
  const questions: ReviewQuestion[] = library.questions
    .filter((question) => (question.kinds === undefined || question.kinds.includes(contract.kind)) && evalCondition(question.when, ctx))
    .map((question) => ({
      topic: question.topic,
      text: fill(question.text),
      ...(question.clauseId ? clauseNumber(question.clauseId) : {}),
    }));

  // A final agreement keeps the wording it was signed with. If the template has moved on since, say so rather than
  // pretend the explanations below describe that wording.
  const frozenElsewhere = doc.libraryVersion !== '' && doc.libraryVersion !== library.version;
  const clauses: ReviewClause[] = doc.clauses.map((docClause) => {
    const source = library.clauses.find((clause) => clause.id === docClause.id && clause.kinds.includes(contract.kind));
    const missing = 'No explanation is available for this clause: it is not in the current template.';
    return {
      number: docClause.number,
      title: docClause.title,
      explanation: source?.explanation ?? missing,
      rationale: source?.rationale ?? missing,
      risk: source?.risk ?? missing,
    };
  });
  const unprintable = unprintableCharacters(documentText(doc));

  return {
    contractTitle: contract.title.trim() || KIND_LABELS[contract.kind],
    heading: KIND_HEADINGS[contract.kind],
    kindLabel: KIND_LABELS[contract.kind],
    notice: REVIEW_NOTICE,
    parties: contract.parties.map((party) => ({ role: ROLE_LABELS[party.role], name: party.name.trim() })),
    effectiveDate: formatDate(contract.effectiveDate),
    jurisdiction: `${contract.jurisdiction.city.trim()}, ${contract.jurisdiction.state.trim()}`,
    choices,
    defaultsUnchanged: choices.filter((choice) => choice.isDefault),
    optionalClauses,
    assumptions: library.assumptions.filter((assumption) => assumption.kinds.includes(contract.kind)).map((assumption) => assumption.text),
    keyDates: keyDates(contract, ctx),
    clauses,
    questions,
    notes: library.notes.filter((note) => note.kinds.includes(contract.kind)).map((note) => ({ title: note.title, body: note.body })),
    stampDuty: stampDutyNote(contract.jurisdiction.state),
    libraryVersion: doc.libraryVersion || library.version,
    warnings: unprintable.length > 0 ? [unprintableMessage(unprintable)] : [],
    ...(frozenElsewhere
      ? {
          frozenNote: `The wording of this agreement was frozen under template version ${doc.libraryVersion}. The choices, explanations and questions below come from the current template version ${library.version} and may not match that wording exactly. Read the agreement text itself.`,
        }
      : {}),
  };
}

/** The agreement together with its review summary: what the Review pack export prints. */
export function buildReviewPack(contract: Contract, library: ContractLibraryShape = LIBRARY): ReviewPack {
  const document = resolveContractDocument(contract, library);
  // A final agreement carries the summary written when it was finalised, so it matches its frozen wording exactly.
  if (contract.status === 'final' && contract.finalDocument && contract.finalSummary) return { document, summary: cleanDeep(contract.finalSummary) };
  return { document, summary: cleanDeep(buildReviewSummary(contract, library, document)) };
}

/** All the text of a review summary in reading order, for searching and tests. */
export function reviewText(summary: ReviewSummary): string {
  const lines: string[] = [summary.heading, summary.notice, summary.contractTitle];
  for (const choice of summary.choices) lines.push(`${choice.label}: ${choice.value}`);
  for (const date of summary.keyDates) lines.push(`${date.label}: ${date.value}${date.note ? ` (${date.note})` : ''}`);
  for (const clause of summary.clauses) lines.push(`${clause.number}. ${clause.title}`, clause.explanation, clause.rationale, clause.risk);
  for (const question of summary.questions) lines.push(`${question.topic}: ${question.text}`);
  for (const assumption of summary.assumptions) lines.push(assumption);
  for (const note of summary.notes) lines.push(note.title, note.body);
  lines.push(summary.stampDuty.text);
  if (summary.frozenNote) lines.push(summary.frozenNote);
  lines.push(...summary.warnings);
  return lines.join('\n');
}
