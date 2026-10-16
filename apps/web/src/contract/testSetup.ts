import { vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createContractStorage, type Contract, type ContractKind, type ContractStorage } from '@solokit/tool-contract';
import { makeContract } from '@solokit/tool-contract/testing';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeClient, makeSeller } from '@solokit/tool-invoice/testing';
import type { ContractExporter } from './exporters';

export const NOW = new Date('2026-10-16T10:00:00.000Z');

/** Storage over a fresh in-memory database, with a fixed clock. */
export async function makeStorage({ profile = true }: { profile?: boolean } = {}) {
  const store = createMemoryStore();
  const contracts = createContractStorage(store, { now: () => NOW });
  const invoice = createInvoiceStorage(store, { now: () => NOW });
  if (profile) await invoice.profile.save(makeSeller());
  return { store, contracts, invoice };
}

export type TestStorage = Awaited<ReturnType<typeof makeStorage>>;

export async function seedDraft(contracts: ContractStorage, kind: ContractKind = 'services', overrides: Partial<Contract> = {}) {
  return contracts.save(makeContract(kind, { id: `draft-${kind}`, title: `Draft ${kind}`, ...overrides }));
}

export async function seedFinal(contracts: ContractStorage, kind: ContractKind = 'nda-mutual', overrides: Partial<Contract> = {}) {
  const saved = await contracts.save(makeContract(kind, { id: `final-${kind}`, title: `Final ${kind}`, ...overrides }));
  return contracts.finalise(saved.id);
}

export { makeClient };

/** An exporter that builds nothing and records what it was asked for. */
export function fakeExporter() {
  return vi.fn<ContractExporter>(async (kind, input) => ({ blob: new Blob([kind], { type: 'application/octet-stream' }), filename: `${input.contract.id}-${kind}` }));
}
