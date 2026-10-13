'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createIndexedDbStore, createMemoryStore, type DataStore } from '@solokit/storage';

export interface StoreState {
  store: DataStore | null;
  /** False when the browser blocked IndexedDB and data will be lost on reload. */
  persistent: boolean;
  ready: boolean;
}

const INITIAL: StoreState = { store: null, persistent: false, ready: false };
const StoreContext = createContext<StoreState>(INITIAL);

export interface StoreProviderProps {
  children: ReactNode;
  factory?: () => DataStore;
}

export function StoreProvider({ children, factory = createIndexedDbStore }: StoreProviderProps) {
  const [state, setState] = useState<StoreState>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: StoreState;
      try {
        const store = factory();
        await store.list('settings');
        next = { store, persistent: true, ready: true };
      } catch {
        next = { store: createMemoryStore(), persistent: false, ready: true };
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [factory]);

  return <StoreContext.Provider value={state}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  return useContext(StoreContext);
}
