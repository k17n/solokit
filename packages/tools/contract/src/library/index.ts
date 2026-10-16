import type { ContractLibraryShape } from '../library-types';
import { SHARED_CLAUSES } from './clauses-shared';
import { NDA_CLAUSES } from './clauses-nda';
import { SERVICES_CLAUSES } from './clauses-services';
import { OPTIONS } from './options';
import { ASSUMPTIONS, NOTES, QUESTIONS } from './questions';
import { VARIABLES } from './variables';

/** Changes whenever any wording, default or question changes, so a review can say which wording a document used. */
export const LIBRARY_VERSION = '2026-10-16.2';

/** Clause order within each kind is the order of this list: NDA clauses, services clauses, then the clauses every kind shares. */
export const LIBRARY: ContractLibraryShape = {
  version: LIBRARY_VERSION,
  clauses: [...NDA_CLAUSES, ...SERVICES_CLAUSES, ...SHARED_CLAUSES],
  variables: VARIABLES,
  options: OPTIONS,
  questions: QUESTIONS,
  assumptions: ASSUMPTIONS,
  notes: NOTES,
};
