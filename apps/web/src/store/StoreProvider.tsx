'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createIndexedDbStore, createMemoryStore, type DataStore } from '@solokit/storage';

export interface StoreState {
  store: DataStore | null;
  /** False when the browser blocked IndexedDB and data will be lost on reload. Check `ready` first. */
  persistent: boolean;
  /** True once the store has been created and probed. Until then `store` is null. */
  ready: boolean;
}

const INITIAL: StoreState = { store: null, persistent: false, ready: false };
const StoreContext = createContext<StoreState>(INITIAL);

export interface StoreProviderProps {
  children: ReactNode;
  /** Read once, when the provider mounts. Later changes of this prop are ignored. */
  factory?: () => DataStore;
}

export function StoreProvider({ children, factory = createIndexedDbStore }: StoreProviderProps) {
  const [state, setState] = useState<StoreState>(INITIAL);
  const factoryRef = useRef(factory);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: StoreState;
      try {
        const store = factoryRef.current();
        await store.list('settings');
        next = { store, persistent: true, ready: true };
      } catch (error) {
        console.warn('SoloKit could not open browser storage; falling back to temporary memory.', error);
        next = { store: createMemoryStore(), persistent: false, ready: true };
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <StoreContext.Provider value={state}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  return useContext(StoreContext);
}
