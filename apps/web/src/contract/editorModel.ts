import { parseMoney } from '@solokit/core';
import { INDIAN_STATES } from '@solokit/tax-engines';
import {
  KIND_LABELS,
  buildReviewSummary,
  LIBRARY,
  clauseTitle,
  createContext,
  formatValue,
  isClauseIncluded,
  isKnownState,
  optionVisible,
  partyFromProfile,
  validateContract,
  variableDefault,
  variableVisible,
  type Clause,
  type Contract,
  type Issue,
  type Milestone,
  type OptionDef,
  type Party,
  type PartySource,
  type ReviewSummary,
  type VariableDef,
  type VariableValue,
} from '@solokit/tool-contract';

/** The fields of one clause that the user fills in, in the order the clauses appear in the agreement. */
export interface FieldGroup {
  clauseId: string;
  title: string;
  options: OptionDef[];
  variables: VariableDef[];
}

export const variableClauseId = (def: VariableDef, kind: Contract['kind']): string => def.clauseIdByKind?.[kind] ?? def.clauseId;

/**
 * Every option and variable that applies to this agreement right now, grouped under its clause. A choice that
 * switches other fields on or off (the fee model, for example) changes what is returned. Fields of an optional
 * clause that is switched off are left out, since that wording is not in the agreement.
 */
export function fieldGroups(contract: Contract): FieldGroup[] {
  const ctx = createContext(contract, LIBRARY);
  const groups: FieldGroup[] = [];
  for (const clause of LIBRARY.clauses) {
    if (!clause.kinds.includes(contract.kind) || !ctx.included.has(clause.id)) continue;
    const options = LIBRARY.options.filter((def) => def.clauseId === clause.id && optionVisible(def, ctx));
    const variables = LIBRARY.variables.filter((def) => variableClauseId(def, contract.kind) === clause.id && variableVisible(def, ctx));
    if (options.length > 0 || variables.length > 0) groups.push({ clauseId: clause.id, title: clauseTitle(clause, contract.kind), options, variables });
  }
  return groups;
}

/** Clauses the user may switch on or off, in agreement order. */
export function optionalClauses(kind: Contract['kind']): Clause[] {
  return LIBRARY.clauses.filter((clause) => clause.kinds.includes(kind) && !clause.required);
}

export function requiredClauses(kind: Contract['kind']): Clause[] {
  return LIBRARY.clauses.filter((clause) => clause.kinds.includes(kind) && clause.required);
}

export type NumberParse = { ok: true; value: VariableValue | undefined } | { ok: false; message: string };

/** Reads what was typed into a numeric field. Empty means "use the template default". */
export function parseVariableText(def: VariableDef, text: string): NumberParse {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, value: undefined };
  switch (def.type) {
    case 'integer':
      return /^\d+$/.test(trimmed) ? { ok: true, value: Number(trimmed) } : { ok: false, message: `${def.label} must be a whole number` };
    case 'number':
      return /^\d+(\.\d+)?$/.test(trimmed) ? { ok: true, value: Number(trimmed) } : { ok: false, message: `${def.label} must be a number` };
    case 'money': {
      const minor = parseMoney(trimmed);
      return minor === null || minor < 0 ? { ok: false, message: `${def.label} must be an amount in rupees with at most two decimals` } : { ok: true, value: minor / 100 };
    }
    default:
      return { ok: true, value: trimmed };
  }
}

export const isNumeric = (def: VariableDef): boolean => def.type === 'integer' || def.type === 'number' || def.type === 'money';

/** What an input should show for a value the user already entered. */
export function textOf(value: VariableValue | undefined): string {
  return value === undefined ? '' : String(value);
}

const UNIT_LABEL = { days: 'days', months: 'months', years: 'years', hours: 'hours', rounds: 'rounds', percent: 'percent' } as const;

/** The field's label with its unit, unless the label already says it. */
export function fieldLabel(def: VariableDef): string {
  if (!def.unit || def.label.includes('(') || def.unit === 'percent') return def.label;
  return `${def.label} (${UNIT_LABEL[def.unit]})`;
}

/** Help text, then what leaving the field empty does, then the allowed range. */
export function fieldHint(def: VariableDef, contract: Contract): string {
  const parts = [def.help];
  const fallback = variableDefault(def, contract);
  if (fallback !== undefined && fallback !== '') {
    parts.push(def.type === 'longtext' ? 'Leave it empty to use the template wording.' : `Leave it empty to use the template default: ${formatValue(def, fallback)}.`);
  }
  if (isNumeric(def) && (def.min !== undefined || def.max !== undefined)) {
    const unit = def.unit && def.unit !== 'percent' ? ` ${def.unit}` : def.unit === 'percent' ? '%' : '';
    if (def.min !== undefined && def.max !== undefined) parts.push(`Between ${def.min} and ${def.max}${unit}.`);
    else if (def.min !== undefined) parts.push(`At least ${def.min}${unit}.`);
    else parts.push(`At most ${def.max}${unit}.`);
  }
  return parts.join(' ');
}

export function setVariable(contract: Contract, id: string, value: VariableValue | undefined): Contract {
  const variables = { ...contract.variables };
  if (value === undefined) delete variables[id];
  else variables[id] = value;
  return { ...contract, variables };
}

export function setOption(contract: Contract, id: string, choice: string): Contract {
  return { ...contract, options: { ...contract.options, [id]: choice } };
}

/** Stores a clause switch only when it differs from the template, so an untouched agreement keeps an empty list. */
export function setClauseIncluded(contract: Contract, clause: Clause, included: boolean): Contract {
  const overrides = { ...contract.clauseOverrides };
  if (included === (clause.defaultIncluded ?? true)) delete overrides[clause.id];
  else overrides[clause.id] = included;
  return { ...contract, clauseOverrides: overrides };
}

export const isIncluded = (contract: Contract, clause: Clause): boolean => isClauseIncluded(clause, contract);

export function updateParty(contract: Contract, index: number, patch: Partial<Omit<Party, 'address'>> & { address?: Partial<Party['address']> }): Contract {
  const parties = contract.parties.map((party, at) => {
    if (at !== index) return party;
    const { address, ...rest } = patch;
    return { ...party, ...rest, address: { ...party.address, ...(address ?? {}) } };
  });
  return { ...contract, parties };
}

/** A person or business that can fill in a party: the seller profile or a saved client. */
export interface PartyChoice {
  id: string;
  label: string;
  source: PartySource & { address: PartySource['address'] & { stateCode?: string | undefined } };
}

const stateNameOf = (stateCode: string | undefined): string | undefined => {
  const name = stateCode ? INDIAN_STATES.find((state) => state.code === stateCode)?.name : undefined;
  return name && isKnownState(name) ? name : undefined;
};

/** Fills a party's business details, keeping the signatory and the company number the user may already have typed. */
export function fillParty(contract: Contract, index: number, source: PartyChoice['source']): Contract {
  const current = contract.parties[index];
  if (!current) return contract;
  const filled = partyFromProfile(current.role, source);
  const state = stateNameOf(source.address.stateCode);
  const next: Party = {
    ...filled,
    address: { ...filled.address, ...(state ? { state } : {}) },
    signatoryName: current.signatoryName,
    signatoryTitle: current.signatoryTitle,
    ...(current.cin ? { cin: current.cin } : {}),
  };
  return { ...contract, parties: contract.parties.map((party, at) => (at === index ? next : party)) };
}

/** A name for an agreement whose title was left empty: "Mutual NDA with Northwind Traders". */
export function suggestedTitle(contract: Contract): string {
  const other = contract.parties[1]?.name.trim();
  return other ? `${KIND_LABELS[contract.kind]} with ${other}` : KIND_LABELS[contract.kind];
}

export function emptyMilestone(id: string): Milestone {
  return { id, title: '', amount: 0, due: '' };
}

/**
 * Everything wrong with the agreement as typed: problems reading a number the user typed come first (so the message
 * says what is wrong with the text), then the library's own checks. One message per field, the first wins.
 */
export function collectIssues(contract: Contract, typed: Record<string, string>): Issue[] {
  const issues: Issue[] = [];
  const ctx = createContext(contract, LIBRARY);
  for (const def of LIBRARY.variables) {
    if (!def.kinds.includes(contract.kind) || !variableVisible(def, ctx) || !isNumeric(def)) continue;
    const text = typed[def.id];
    if (text === undefined) continue;
    const parsed = parseVariableText(def, text);
    if (!parsed.ok) issues.push({ path: `variables.${def.id}`, message: parsed.message });
  }
  return [...issues, ...validateContract(contract)];
}

/** One message per field path, keeping the first. */
export function byField(issues: readonly Issue[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of issues) if (!(issue.path in result)) result[issue.path] = issue.message;
  return result;
}

/** Text that stays in the Review section's problem list, in the order the sections appear. */
export function sectionOf(path: string): 'parties' | 'terms' | 'clauses' | 'jurisdiction' | 'title' {
  if (path === 'title') return 'title';
  if (path.startsWith('parties')) return 'parties';
  if (path.startsWith('jurisdiction') || path === 'placeOfSigning') return 'jurisdiction';
  if (path.startsWith('clauseOverrides')) return 'clauses';
  return 'terms';
}

export const SECTION_LABEL = { title: 'Name', parties: 'Parties', terms: 'Key terms', clauses: 'Optional clauses', jurisdiction: 'Jurisdiction' } as const;

/** What is printed: ignores the counters that change on every save. */
export function signatureOf(contract: Contract): string {
  const { updatedAt: _updated, version: _version, ...rest } = contract;
  return JSON.stringify(rest);
}

export function safeSummary(contract: Contract | null): ReviewSummary | null {
  if (!contract) return null;
  try {
    return buildReviewSummary(contract);
  } catch (error) {
    console.error('Could not build the review summary', error);
    return null;
  }
}

