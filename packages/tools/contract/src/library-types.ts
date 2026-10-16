import type { ContractKind, VariableValue } from './model';

/** A test on the contract's choices, used to switch paragraphs, variables and questions on or off. */
export type Condition =
  | { option: string; is: string | readonly string[] }
  | { variable: string; eq: VariableValue }
  | { variable: string; gt: number }
  | { included: string }
  | { not: Condition }
  | { all: readonly Condition[] };

export interface ClauseItem {
  /** Template text, a list item such as "(a) ...". */
  text: string;
  kinds?: readonly ContractKind[];
  when?: Condition;
}

export interface ClauseParagraph {
  /** Lets other text point at this paragraph: {{ref:clause-id.paragraph-id}}. */
  id?: string;
  /** Template text. Tokens: {{variable}}, {{option}}, {{a}}, {{b}}, {{a.name}}, {{effectiveDate}}, {{city}}, {{state}}, {{ref:clause}}. */
  text: string;
  kinds?: readonly ContractKind[];
  when?: Condition;
  items?: readonly ClauseItem[];
}

export interface Clause {
  id: string;
  title: string;
  /** Replaces the title for specific kinds. */
  titles?: Partial<Record<ContractKind, string>>;
  kinds: readonly ContractKind[];
  /** Required clauses cannot be switched off. */
  required: boolean;
  /** For optional clauses: whether they start switched on. Defaults to true. */
  defaultIncluded?: boolean;
  paragraphs: readonly ClauseParagraph[];
  /** Plain-language "what this means". */
  explanation: string;
  /** "Why it is here". */
  rationale: string;
  /** "Check with a lawyer if ...". */
  risk: string;
}

export type VariableType = 'text' | 'longtext' | 'integer' | 'number' | 'money' | 'date';
export type UnitName = 'days' | 'months' | 'years' | 'hours' | 'rounds' | 'percent';

export interface VariableDef {
  id: string;
  label: string;
  help: string;
  type: VariableType;
  kinds: readonly ContractKind[];
  /** The clause this belongs to, so the review can show the clause number. */
  clauseId: string;
  /** For kinds whose clause has a different id. */
  clauseIdByKind?: Partial<Record<ContractKind, string>>;
  /** Must have a value (user's or default) whenever it is shown. Defaults to true. */
  required?: boolean;
  default?: VariableValue;
  defaultByKind?: Partial<Record<ContractKind, VariableValue>>;
  /** Take the default from the contract: the jurisdiction city. */
  defaultFrom?: 'jurisdiction.city';
  min?: number;
  max?: number;
  unit?: UnitName;
  /** Only asked for, validated and shown when this holds. */
  when?: Condition;
  /** Text variables used inside a sentence: trailing full stops are dropped. */
  inline?: boolean;
  example?: string;
}

export interface OptionChoice {
  id: string;
  /** May contain {{a}} and {{b}}. */
  label: string;
  /** A plain sentence saying what this choice does, for the review. May contain {{a}} and {{b}}. */
  summary: string;
  kinds?: readonly ContractKind[];
}

export interface OptionDef {
  id: string;
  label: string;
  help: string;
  kinds: readonly ContractKind[];
  clauseId: string;
  choices: readonly OptionChoice[];
  /** Options without a default must be chosen. */
  default?: string;
  when?: Condition;
}

export interface LawyerQuestion {
  id: string;
  /** What the question is about, as a short heading. */
  topic: string;
  /** Template text; may use the same tokens as clause text. */
  text: string;
  kinds?: readonly ContractKind[];
  when?: Condition;
  clauseId?: string;
}

export interface LibraryNote {
  id: string;
  title: string;
  body: string;
  kinds: readonly ContractKind[];
}

export interface LibraryAssumption {
  id: string;
  text: string;
  kinds: readonly ContractKind[];
}

/** Everything the builders read. The real data is in library.ts; tests can pass a small one. */
export interface ContractLibraryShape {
  version: string;
  clauses: readonly Clause[];
  variables: readonly VariableDef[];
  options: readonly OptionDef[];
  questions: readonly LawyerQuestion[];
  assumptions: readonly LibraryAssumption[];
  notes: readonly LibraryNote[];
}
