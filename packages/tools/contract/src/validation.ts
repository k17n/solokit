import { validateGstin } from '@solokit/tax-engines';
import { isRealIsoDate } from './dates';
import { createContext, isValidChoice, optionVisible, variableVisible, type Context } from './engine';
import { LIBRARY } from './library';
import type { ContractLibraryShape, VariableDef } from './library-types';
import { CONTRACT_KINDS, PARTY_ROLES, type Contract, type Party } from './model';
import { isKnownState } from './stamp-duty';

export interface Issue {
  path: string;
  message: string;
}

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const CIN = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT = 300;
const MAX_LONG_TEXT = 5000;

const blank = (value: string | undefined): boolean => value === undefined || value.trim() === '';

function validateParty(party: Party | undefined, index: number, issues: Issue[]): void {
  const at = (field: string) => `parties.${index}.${field}`;
  if (!party) return;
  if (blank(party.name)) issues.push({ path: at('name'), message: 'Enter the name of this party' });
  if (blank(party.address?.line1)) issues.push({ path: at('address.line1'), message: 'Enter the address' });
  if (blank(party.address?.city)) issues.push({ path: at('address.city'), message: 'Enter the city' });
  if (blank(party.email)) issues.push({ path: at('email'), message: 'Enter an email address, which is used for notices' });
  else if (!EMAIL.test(party.email.trim())) issues.push({ path: at('email'), message: 'Enter a valid email address' });
  if (blank(party.signatoryName)) issues.push({ path: at('signatoryName'), message: 'Enter the name of the person who will sign' });
  if (blank(party.signatoryTitle)) issues.push({ path: at('signatoryTitle'), message: 'Enter the signatory\'s role, for example Director, Partner or Proprietor' });
  if (!blank(party.pan) && !PAN.test(party.pan!.trim().toUpperCase())) issues.push({ path: at('pan'), message: 'PAN must look like ABCDE1234F' });
  if (!blank(party.gstin)) {
    const result = validateGstin(party.gstin!);
    if (!result.valid) issues.push({ path: at('gstin'), message: result.reason });
  }
  if (!blank(party.cin) && !CIN.test(party.cin!.trim().toUpperCase())) issues.push({ path: at('cin'), message: 'CIN must be 21 characters, for example U12345MH2020PTC123456' });
}

function decimalsOk(value: number): boolean {
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

function validateVariable(def: VariableDef, ctx: Context, issues: Issue[]): void {
  const path = `variables.${def.id}`;
  const own = ctx.contract.variables[def.id];
  const value = ctx.values[def.id];
  const ownIsBlank = own === undefined || (typeof own === 'string' && own.trim() === '') || (typeof own === 'number' && Number.isNaN(own));
  if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
    if (def.required !== false) issues.push({ path, message: `Fill in: ${def.label}` });
    return;
  }
  // A value the user typed is checked even when the default would have been fine.
  const checked = ownIsBlank ? value : own;
  switch (def.type) {
    case 'text':
    case 'longtext': {
      const text = String(checked);
      const limit = def.type === 'text' ? MAX_TEXT : MAX_LONG_TEXT;
      if (typeof checked !== 'string') issues.push({ path, message: `${def.label} must be text` });
      else if (text.length > limit) issues.push({ path, message: `${def.label} is too long (the limit is ${limit} characters)` });
      return;
    }
    case 'date': {
      if (typeof checked !== 'string' || !isRealIsoDate(checked)) issues.push({ path, message: `${def.label} must be a real date` });
      return;
    }
    case 'integer':
    case 'number':
    case 'money': {
      if (typeof checked !== 'number' || !Number.isFinite(checked)) {
        issues.push({ path, message: `${def.label} must be a number` });
        return;
      }
      if (def.type === 'integer' && !Number.isInteger(checked)) {
        issues.push({ path, message: `${def.label} must be a whole number` });
        return;
      }
      if (def.type === 'money' && !decimalsOk(checked)) {
        issues.push({ path, message: `${def.label} can have at most two decimal places` });
        return;
      }
      if (def.min !== undefined && checked < def.min) issues.push({ path, message: `${def.label} must be at least ${def.min}` });
      else if (def.max !== undefined && checked > def.max) issues.push({ path, message: `${def.label} must be at most ${def.max}` });
    }
  }
}

/**
 * Checks a contract and returns one issue per problem, each with the field it belongs to
 * (`parties.0.name`, `variables.purpose`, `options.feeModel`, `milestones.1.amount`, ...).
 * An empty list means {@link buildContractDocument} will succeed.
 */
export function validateContract(contract: Contract, library: ContractLibraryShape = LIBRARY): Issue[] {
  const issues: Issue[] = [];
  if (!CONTRACT_KINDS.includes(contract.kind)) {
    return [{ path: 'kind', message: 'Choose which kind of agreement this is' }];
  }
  if (blank(contract.title)) issues.push({ path: 'title', message: 'Give this agreement a name so you can find it later' });

  const roles = PARTY_ROLES[contract.kind];
  if (contract.parties.length !== 2) {
    issues.push({ path: 'parties', message: 'An agreement needs exactly two parties' });
  } else {
    contract.parties.forEach((party, index) => {
      if (party.role !== roles[index]) issues.push({ path: `parties.${index}.role`, message: 'This party has the wrong role for this kind of agreement' });
      validateParty(party, index, issues);
    });
    const [first, second] = contract.parties as [Party, Party];
    if (!blank(first.name) && first.name.trim().toLowerCase() === second.name.trim().toLowerCase()) {
      issues.push({ path: 'parties.1.name', message: 'The two parties need different names' });
    }
  }

  if (!isRealIsoDate(contract.effectiveDate)) issues.push({ path: 'effectiveDate', message: 'Enter a real effective date' });
  if (blank(contract.jurisdiction.city)) issues.push({ path: 'jurisdiction.city', message: 'Choose the city whose courts (or arbitration seat) will apply' });
  if (blank(contract.jurisdiction.state)) issues.push({ path: 'jurisdiction.state', message: 'Choose the state' });
  else if (!isKnownState(contract.jurisdiction.state)) issues.push({ path: 'jurisdiction.state', message: 'Choose a state or union territory from the list' });

  for (const [id, wanted] of Object.entries(contract.clauseOverrides)) {
    const clause = library.clauses.find((candidate) => candidate.id === id && candidate.kinds.includes(contract.kind));
    if (!clause) issues.push({ path: `clauseOverrides.${id}`, message: 'This clause does not exist in this kind of agreement' });
    else if (clause.required && wanted === false) issues.push({ path: `clauseOverrides.${id}`, message: `${clause.title} is required and cannot be removed` });
  }

  const ctx = createContext(contract, library);
  for (const def of library.options) {
    if (!optionVisible(def, ctx)) continue;
    const path = `options.${def.id}`;
    const own = contract.options[def.id];
    if (own !== undefined && !isValidChoice(def, own, contract.kind)) issues.push({ path, message: `Choose one of the listed options for: ${def.label}` });
    else if (ctx.choices[def.id] === undefined) issues.push({ path, message: `Choose: ${def.label}` });
  }
  for (const def of library.variables) {
    if (variableVisible(def, ctx)) validateVariable(def, ctx, issues);
  }

  const endDate = ctx.values['endDate'];
  if (ctx.choices['term'] === 'fixed' && typeof endDate === 'string' && isRealIsoDate(endDate) && isRealIsoDate(contract.effectiveDate) && endDate <= contract.effectiveDate) {
    issues.push({ path: 'variables.endDate', message: 'The end date must be after the effective date' });
  }

  if (contract.kind === 'services' && ctx.choices['feeModel'] === 'milestones') {
    if (contract.milestones.length === 0) issues.push({ path: 'milestones', message: 'Add at least one milestone' });
    contract.milestones.forEach((milestone, index) => {
      if (blank(milestone.title)) issues.push({ path: `milestones.${index}.title`, message: 'Name this milestone' });
      if (!Number.isFinite(milestone.amount) || milestone.amount <= 0) issues.push({ path: `milestones.${index}.amount`, message: 'Enter the amount for this milestone' });
      else if (!decimalsOk(milestone.amount)) issues.push({ path: `milestones.${index}.amount`, message: 'The amount can have at most two decimal places' });
      if (blank(milestone.due)) issues.push({ path: `milestones.${index}.due`, message: 'Say when this milestone is due or what triggers it' });
    });
  }
  return issues;
}
