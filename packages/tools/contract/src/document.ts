import { assertComplete, clauseTitle, createContext, isClauseIncluded, itemsFor, paragraphsFor, renderTemplate, type Context, type ReferenceMap } from './engine';
import { formatRupees, formatRupeesWithWords } from './format';
import { formatDate } from './dates';
import { LIBRARY } from './library';
import { cleanDeep } from './text';
import type { ContractLibraryShape } from './library-types';
import { KIND_HEADINGS, ROLE_LABELS, type Contract, type Party } from './model';

export const TEMPLATE_NOTICE =
  'Prepared from a SoloKit template. A template is not legal advice. Have this document reviewed by a lawyer before you sign it.';

export interface DocItem {
  /** "(a)" */
  label: string;
  text: string;
}

export interface DocParagraph {
  /** "4.2" */
  number: string;
  text: string;
  items: DocItem[];
}

export interface DocClause {
  id: string;
  /** "4" */
  number: string;
  title: string;
  paragraphs: DocParagraph[];
}

export interface DocParty {
  /** "(1)" */
  label: string;
  text: string;
}

export interface DocScheduleSection {
  heading: string;
  lines: string[];
}

export interface DocSchedule {
  title: string;
  sections: DocScheduleSection[];
}

export interface DocSignature {
  /** "Signed for and on behalf of Asha Rao (the Freelancer)" */
  heading: string;
  signatoryName: string;
  signatoryTitle: string;
  place?: string;
}

export interface ContractDocument {
  contractId: string;
  kind: Contract['kind'];
  heading: string;
  introduction: string;
  parties: DocParty[];
  closing: string;
  clauses: DocClause[];
  schedules: DocSchedule[];
  signatureIntro: string;
  signatures: DocSignature[];
  notice: string;
  libraryVersion: string;
}

const letter = (index: number): string => {
  if (index >= 26) throw new Error('A paragraph cannot have more than 26 list items');
  return `(${String.fromCharCode(97 + index)})`;
};

function describeAddress(party: Party): string {
  const { address } = party;
  const parts = [address.line1, address.line2, address.city, address.state, address.postalCode, address.country]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part);
  return parts.join(', ');
}

function describeParty(party: Party, index: number, count: number): DocParty {
  const ids = [party.pan?.trim() && `PAN ${party.pan.trim()}`, party.gstin?.trim() && `GSTIN ${party.gstin.trim()}`, party.cin?.trim() && `CIN ${party.cin.trim()}`].filter(
    (part): part is string => !!part,
  );
  const identity = ids.length > 0 ? `, ${ids.join(', ')}` : '';
  const ending = index === count - 1 ? '.' : index === count - 2 ? '; and' : ';';
  return {
    label: `(${index + 1})`,
    text: `${party.name.trim()}, of ${describeAddress(party)}${identity}, represented by ${party.signatoryName.trim()}, ${party.signatoryTitle.trim()} (the "${ROLE_LABELS[party.role]}")${ending}`,
  };
}

const splitLines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');

function buildServicesSchedule(ctx: Context): DocSchedule {
  const { contract } = ctx;
  const text = (id: string): string => String(ctx.values[id] ?? '');
  const sections: DocScheduleSection[] = [
    { heading: 'Part 1 - Services', lines: splitLines(text('servicesDescription')) },
    { heading: 'Part 2 - Deliverables', lines: splitLines(text('deliverables')) },
  ];

  const timetable = [`Start date: ${formatDate(contract.effectiveDate)}.`];
  if (ctx.choices['term'] === 'fixed' && ctx.values['endDate']) timetable.push(`End date: ${formatDate(String(ctx.values['endDate']))}.`);
  if (ctx.choices['term'] === 'ongoing') timetable.push('This is an ongoing engagement with no fixed end date.');
  sections.push({ heading: 'Part 3 - Timetable', lines: timetable });

  const fees: string[] = [];
  switch (ctx.choices['feeModel']) {
    case 'fixed':
      fees.push(`Fixed fee: ${formatRupeesWithWords(Number(ctx.values['fixedFee']))}.`);
      break;
    case 'hourly':
      fees.push(`Hourly rate: ${formatRupeesWithWords(Number(ctx.values['hourlyRate']))} per hour.`);
      if (typeof ctx.values['estimatedHours'] === 'number') fees.push(`Estimate (not a cap): ${ctx.values['estimatedHours']} hours.`);
      break;
    case 'retainer':
      fees.push(`Monthly retainer: ${formatRupeesWithWords(Number(ctx.values['retainerFee']))} per month.`);
      if (typeof ctx.values['retainerHours'] === 'number') fees.push(`Hours covered each month: up to ${ctx.values['retainerHours']}.`);
      break;
    case 'milestones': {
      let totalPaise = 0;
      contract.milestones.forEach((milestone, index) => {
        totalPaise += Math.round(milestone.amount * 100);
        fees.push(`Milestone ${index + 1}: ${milestone.title.trim()} - ${formatRupees(milestone.amount)} - ${milestone.due.trim()}.`);
      });
      fees.push(`Total of the milestones: ${formatRupees(totalPaise / 100)}.`);
      break;
    }
  }
  fees.push('All amounts are before GST and any tax deducted at source, as explained in the clause on fees and payment.');
  sections.push({ heading: 'Part 4 - Fees', lines: fees });

  return { title: 'Schedule 1 - Services, Deliverables, Timetable and Fees', sections };
}

/**
 * Builds the agreement as plain structured data: numbered clauses, filled in and cross-referenced. Throws
 * {@link ContractRenderError} if anything the chosen clauses need is missing, so a half-empty document is never produced.
 * Check validateContract first to get friendly, per-field messages.
 */
export function buildContractDocument(contract: Contract, library: ContractLibraryShape = LIBRARY): ContractDocument {
  const ctx = createContext(contract, library);
  assertComplete(ctx);
  const planned = library.clauses
    .filter((clause) => isClauseIncluded(clause, contract))
    .map((clause, index) => ({
      clause,
      number: String(index + 1),
      paragraphs: paragraphsFor(clause, ctx).map((paragraph, at) => ({ paragraph, number: `${index + 1}.${at + 1}` })),
    }));

  const refs = new Map<string, string>();
  for (const { clause, number, paragraphs } of planned) {
    refs.set(clause.id, number);
    for (const { paragraph, number: paragraphNumber } of paragraphs) {
      if (paragraph.id) refs.set(`${clause.id}.${paragraph.id}`, paragraphNumber);
    }
  }
  const fill = (text: string) => renderTemplate(text, ctx, refs as ReferenceMap);

  const clauses: DocClause[] = planned.map(({ clause, number, paragraphs }) => ({
    id: clause.id,
    number,
    title: clauseTitle(clause, contract.kind),
    paragraphs: paragraphs.map(({ paragraph, number: paragraphNumber }) => ({
      number: paragraphNumber,
      text: fill(paragraph.text),
      items: itemsFor(paragraph, ctx).map((item, at) => ({ label: letter(at), text: fill(item.text) })),
    })),
  }));

  const parties = contract.parties.map((party, index) => describeParty(party, index, contract.parties.length));
  const schedules = contract.kind === 'services' ? [buildServicesSchedule(ctx)] : [];

  const built: ContractDocument = {
    contractId: contract.id,
    kind: contract.kind,
    heading: KIND_HEADINGS[contract.kind],
    introduction: `This agreement (the "Agreement") is made on ${formatDate(contract.effectiveDate)} (the "Effective Date") between:`,
    parties,
    closing: 'Each of them is a "Party" and together they are the "Parties". The Parties agree as follows.',
    clauses,
    schedules,
    signatureIntro: 'Signed by the Parties on the dates written below.',
    signatures: contract.parties.map((party) => ({
      heading: `Signed for and on behalf of ${party.name.trim()} (the ${ROLE_LABELS[party.role]})`,
      signatoryName: party.signatoryName.trim(),
      signatoryTitle: party.signatoryTitle.trim(),
      ...(contract.placeOfSigning?.trim() ? { place: contract.placeOfSigning.trim() } : {}),
    })),
    notice: TEMPLATE_NOTICE,
    libraryVersion: library.version,
  };
  // Text pasted from Word or a PDF can carry control characters that no Word file or PDF can hold.
  return cleanDeep(built);
}

/**
 * The document to show or export. A final contract returns the wording frozen when it was finalised, so a
 * signed document never changes if the template library is updated later; a draft is built from the current library.
 */
export function resolveContractDocument(contract: Contract, library: ContractLibraryShape = LIBRARY): ContractDocument {
  if (contract.status === 'final' && contract.finalDocument) return cleanDeep(contract.finalDocument);
  return buildContractDocument(contract, library);
}

/** All the text of a document in reading order, for searching and tests. */
export function documentText(doc: ContractDocument): string {
  const lines: string[] = [doc.heading, doc.introduction, ...doc.parties.map((party) => `${party.label} ${party.text}`), doc.closing];
  for (const clause of doc.clauses) {
    lines.push(`${clause.number}. ${clause.title}`);
    for (const paragraph of clause.paragraphs) {
      lines.push(`${paragraph.number} ${paragraph.text}`);
      for (const item of paragraph.items) lines.push(`${item.label} ${item.text}`);
    }
  }
  for (const schedule of doc.schedules) {
    lines.push(schedule.title);
    for (const section of schedule.sections) lines.push(section.heading, ...section.lines);
  }
  lines.push(doc.signatureIntro);
  for (const signature of doc.signatures) lines.push(signature.heading, signature.signatoryName, signature.signatoryTitle);
  lines.push(doc.notice);
  return lines.join('\n');
}
