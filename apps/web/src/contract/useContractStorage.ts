import { useMemo } from 'react';
import type { DataStore } from '@solokit/storage';
import { createContractStorage, type ContractStorage } from '@solokit/tool-contract';
import { createInvoiceStorage, type InvoiceStorage } from '@solokit/tool-invoice';
import { useStore } from '../store/StoreProvider';

export interface ContractStorageState {
  contracts: ContractStorage | null;
  /** The invoice tool's storage over the same database: the seller profile, saved clients, themes and the backup time. */
  invoice: InvoiceStorage | null;
  store: DataStore | null;
  persistent: boolean;
  ready: boolean;
}

export function useContractStorage(now?: () => Date): ContractStorageState {
  const { store, persistent, ready } = useStore();
  const storages = useMemo(
    () => (store ? { contracts: createContractStorage(store, now ? { now } : {}), invoice: createInvoiceStorage(store, now ? { now } : {}) } : null),
    [store, now],
  );
  return { contracts: storages?.contracts ?? null, invoice: storages?.invoice ?? null, store, persistent, ready };
}
