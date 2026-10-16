import type { DataStore } from '@solokit/storage';
import { buildContractDocument } from './document';
import { LIBRARY_VERSION } from './library';
import type { Contract } from './model';
import { validateContract, type Issue } from './validation';

export class ContractLockedError extends Error {
  constructor(message = 'This agreement is final. Reopen it to make changes, or duplicate it to start a new version.') {
    super(message);
    this.name = 'ContractLockedError';
  }
}

export class ContractInvalidError extends Error {
  constructor(
    message: string,
    readonly issues: Issue[],
  ) {
    super(message);
    this.name = 'ContractInvalidError';
  }
}

export interface ContractStorageOptions {
  now?: () => Date;
}

export interface ContractStorage {
  /** Newest change first. */
  list(): Promise<Contract[]>;
  get(id: string): Promise<Contract | undefined>;
  /** Saves a draft. A final agreement cannot be changed this way ({@link ContractLockedError}); use reopen first. */
  save(contract: Contract): Promise<Contract>;
  remove(id: string): Promise<void>;
  /** A new draft copy with a new id and the title "... (copy)". Works for drafts and final agreements. */
  duplicate(id: string, input: { id: string; title?: string }): Promise<Contract>;
  /** Checks the agreement, freezes its wording and locks it. Throws {@link ContractInvalidError} listing what is missing. */
  finalise(id: string): Promise<Contract>;
  /** Unlocks a final agreement so it can be edited again. Its frozen wording is dropped. */
  reopen(id: string): Promise<Contract>;
}

export function createContractStorage(store: DataStore, options: ContractStorageOptions = {}): ContractStorage {
  const now = options.now ?? (() => new Date());

  async function write(contract: Contract, previous: Contract | undefined): Promise<Contract> {
    const stamp = now().toISOString();
    const saved: Contract = {
      ...contract,
      createdAt: previous?.createdAt ?? (contract.createdAt || stamp),
      updatedAt: stamp,
      version: (previous?.version ?? 0) + 1,
    };
    await store.put('contracts', saved);
    return saved;
  }

  const get = (id: string) => store.get<Contract>('contracts', id);

  return {
    async list() {
      const all = await store.list<Contract>('contracts');
      return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
    },
    get,
    async save(contract) {
      const previous = await get(contract.id);
      if (previous?.status === 'final') throw new ContractLockedError();
      if (contract.status === 'final') throw new ContractLockedError('Use finalise to make an agreement final, so it is checked first.');
      const { finalDocument: _dropped, ...rest } = contract;
      return write({ ...rest, libraryVersion: contract.libraryVersion || LIBRARY_VERSION }, previous);
    },
    remove: (id) => store.remove('contracts', id),
    async duplicate(id, input) {
      const source = await get(id);
      if (!source) throw new Error('Agreement not found');
      const stamp = now().toISOString();
      const { finalDocument: _frozen, ...rest } = structuredClone(source);
      const copy: Contract = {
        ...rest,
        id: input.id,
        title: input.title ?? `${source.title} (copy)`,
        status: 'draft',
        createdAt: stamp,
        updatedAt: stamp,
        version: 0,
        libraryVersion: LIBRARY_VERSION,
      };
      return write(copy, undefined);
    },
    async finalise(id) {
      const existing = await get(id);
      if (!existing) throw new Error('Agreement not found');
      if (existing.status === 'final') return existing;
      const issues = validateContract(existing);
      if (issues.length > 0) {
        throw new ContractInvalidError(`This agreement is not complete yet (${issues.length} ${issues.length === 1 ? 'problem' : 'problems'} to fix)`, issues);
      }
      const finalDocument = buildContractDocument(existing);
      return write({ ...existing, status: 'final', finalDocument, libraryVersion: LIBRARY_VERSION }, existing);
    },
    async reopen(id) {
      const existing = await get(id);
      if (!existing) throw new Error('Agreement not found');
      if (existing.status !== 'final') return existing;
      const { finalDocument: _frozen, ...rest } = existing;
      return write({ ...rest, status: 'draft' }, existing);
    },
  };
}
