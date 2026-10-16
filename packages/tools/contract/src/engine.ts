import { formatDate } from './dates';
import { formatValue } from './format';
import type { Clause, ClauseItem, ClauseParagraph, Condition, ContractLibraryShape, OptionDef, VariableDef } from './library-types';
import { PARTY_ROLES, ROLE_LABELS, type Contract, type ContractKind, type VariableValue } from './model';

export type RenderErrorCode = 'missing-variable' | 'unknown-token' | 'unknown-reference';

/** Thrown when a template cannot be filled in. A missing value is always an error, never blank text. */
export class ContractRenderError extends Error {
  constructor(
    message: string,
    readonly code: RenderErrorCode,
    readonly token?: string,
  ) {
    super(message);
    this.name = 'ContractRenderError';
  }
}

const isBlank = (value: VariableValue | undefined): boolean =>
  value === undefined || (typeof value === 'string' && value.trim() === '') || (typeof value === 'number' && Number.isNaN(value));

export interface Context {
  contract: Contract;
  library: ContractLibraryShape;
  /** The value of each variable that applies to this kind: the user's, else the default. */
  values: Record<string, VariableValue | undefined>;
  /** The choice of each option that applies to this kind: the user's, else the default. */
  choices: Record<string, string | undefined>;
  /** Ids of the clauses in this agreement. */
  included: ReadonlySet<string>;
}

const appliesTo = (kinds: readonly ContractKind[] | undefined, kind: ContractKind): boolean => kinds === undefined || kinds.includes(kind);

export function variableDefault(def: VariableDef, contract: Contract): VariableValue | undefined {
  if (def.defaultFrom === 'jurisdiction.city') {
    const city = contract.jurisdiction.city.trim();
    return city === '' ? undefined : city;
  }
  return def.defaultByKind?.[contract.kind] ?? def.default;
}

export function isClauseIncluded(clause: Clause, contract: Contract): boolean {
  if (!clause.kinds.includes(contract.kind)) return false;
  if (clause.required) return true;
  return contract.clauseOverrides[clause.id] ?? clause.defaultIncluded ?? true;
}

export function isValidChoice(def: OptionDef, choiceId: string | undefined, kind: ContractKind): boolean {
  return choiceId !== undefined && def.choices.some((choice) => choice.id === choiceId && appliesTo(choice.kinds, kind));
}

export function createContext(contract: Contract, library: ContractLibraryShape): Context {
  const included = new Set(library.clauses.filter((clause) => isClauseIncluded(clause, contract)).map((clause) => clause.id));
  const values: Record<string, VariableValue | undefined> = {};
  for (const def of library.variables) {
    if (!def.kinds.includes(contract.kind)) continue;
    const own = contract.variables[def.id];
    values[def.id] = isBlank(own) ? variableDefault(def, contract) : own;
  }
  const choices: Record<string, string | undefined> = {};
  for (const def of library.options) {
    if (!def.kinds.includes(contract.kind)) continue;
    const own = contract.options[def.id];
    choices[def.id] = isValidChoice(def, own, contract.kind) ? own : def.default;
  }
  return { contract, library, values, choices, included };
}

export function evalCondition(condition: Condition | undefined, ctx: Context): boolean {
  if (condition === undefined) return true;
  if ('not' in condition) return !evalCondition(condition.not, ctx);
  if ('all' in condition) return condition.all.every((inner) => evalCondition(inner, ctx));
  if ('included' in condition) return ctx.included.has(condition.included);
  if ('option' in condition) {
    const chosen = ctx.choices[condition.option];
    if (chosen === undefined) return false;
    return typeof condition.is === 'string' ? chosen === condition.is : condition.is.includes(chosen);
  }
  const value = ctx.values[condition.variable];
  if ('gt' in condition) return typeof value === 'number' && value > condition.gt;
  return value !== undefined && value === condition.eq;
}

export const variableVisible = (def: VariableDef, ctx: Context): boolean => def.kinds.includes(ctx.contract.kind) && evalCondition(def.when, ctx);
export const optionVisible = (def: OptionDef, ctx: Context): boolean => def.kinds.includes(ctx.contract.kind) && evalCondition(def.when, ctx);

/** The defined terms of the two parties, for example "Freelancer" and "Client". */
export function partyTerms(kind: ContractKind): { a: string; b: string } {
  const [a, b] = PARTY_ROLES[kind];
  return { a: ROLE_LABELS[a], b: ROLE_LABELS[b] };
}

export function paragraphsFor(clause: Clause, ctx: Context): ClauseParagraph[] {
  return clause.paragraphs.filter((paragraph) => appliesTo(paragraph.kinds, ctx.contract.kind) && evalCondition(paragraph.when, ctx));
}

export function itemsFor(paragraph: ClauseParagraph, ctx: Context): ClauseItem[] {
  return (paragraph.items ?? []).filter((item) => appliesTo(item.kinds, ctx.contract.kind) && evalCondition(item.when, ctx));
}

export function clauseTitle(clause: Clause, kind: ContractKind): string {
  return clause.titles?.[kind] ?? clause.title;
}

/** Clause number ("4") and paragraph number ("4.2") for every id that can be referred to: "clause-id" and "clause-id.paragraph-id". */
export type ReferenceMap = ReadonlyMap<string, string>;

const TOKEN = /\{\{\s*([^{}\s]+)\s*\}\}/g;

/** Every token in a template, without the braces. */
export function tokensIn(text: string): string[] {
  return [...text.matchAll(TOKEN)].map((match) => match[1] as string);
}

function missing(token: string): never {
  throw new ContractRenderError(`No value for {{${token}}}. Fill it in before building the document.`, 'missing-variable', token);
}

function resolveToken(token: string, ctx: Context, refs: ReferenceMap): string {
  if (token.startsWith('ref:')) {
    const target = token.slice(4);
    const found = refs.get(target);
    if (found === undefined) {
      throw new ContractRenderError(`Cross-reference "${target}" points at a clause or paragraph that is not in this agreement`, 'unknown-reference', token);
    }
    return found;
  }
  const { contract } = ctx;
  const terms = partyTerms(contract.kind);
  switch (token) {
    case 'a':
      return terms.a;
    case 'b':
      return terms.b;
    case 'a.name':
      return contract.parties[0]?.name.trim() || missing(token);
    case 'b.name':
      return contract.parties[1]?.name.trim() || missing(token);
    case 'effectiveDate':
      return contract.effectiveDate ? formatDate(contract.effectiveDate) : missing(token);
    case 'city':
      return contract.jurisdiction.city.trim() || missing(token);
    case 'state':
      return contract.jurisdiction.state.trim() || missing(token);
  }
  const def = ctx.library.variables.find((candidate) => candidate.id === token && candidate.kinds.includes(contract.kind));
  if (def) {
    const value = ctx.values[def.id];
    if (value === undefined || isBlank(value)) return missing(token);
    return formatValue(def, value);
  }
  const option = ctx.library.options.find((candidate) => candidate.id === token && candidate.kinds.includes(contract.kind));
  if (option) {
    const choice = option.choices.find((candidate) => candidate.id === ctx.choices[option.id]);
    if (!choice) return missing(token);
    return choice.label.replaceAll('{{a}}', terms.a).replaceAll('{{b}}', terms.b);
  }
  throw new ContractRenderError(`The template uses {{${token}}}, which is not a known variable, option or reference`, 'unknown-token', token);
}

/** Fills a template. A missing value, an unknown token or a reference to a clause that is not in the agreement throws {@link ContractRenderError}. */
export function renderTemplate(text: string, ctx: Context, refs: ReferenceMap): string {
  return text.replace(TOKEN, (_whole, token: string) => resolveToken(token, ctx, refs));
}

/**
 * Throws if any option that applies has no choice, or any required variable that applies has no value, even if
 * no template happens to use it. This stops a document being built with a whole section silently left out.
 */
export function assertComplete(ctx: Context): void {
  for (const def of ctx.library.options) {
    if (optionVisible(def, ctx) && ctx.choices[def.id] === undefined) {
      throw new ContractRenderError(`No choice made for "${def.label}". Choose one before building the document.`, 'missing-variable', def.id);
    }
  }
  for (const def of ctx.library.variables) {
    if (!variableVisible(def, ctx) || def.required === false) continue;
    const value = ctx.values[def.id];
    if (value === undefined || isBlank(value)) missing(def.id);
  }
}
