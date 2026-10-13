import { useMemo } from 'react';
import { createInvoiceStorage, type InvoiceStorage } from '@solokit/tool-invoice';
import type { DataStore } from '@solokit/storage';
import { useStore } from '../store/StoreProvider';

export interface InvoiceStorageState {
  storage: InvoiceStorage | null;
  store: DataStore | null;
  persistent: boolean;
  ready: boolean;
}

export function useInvoiceStorage(): InvoiceStorageState {
  const { store, persistent, ready } = useStore();
  const storage = useMemo(() => (store ? createInvoiceStorage(store) : null), [store]);
  return { storage, store, persistent, ready };
}
