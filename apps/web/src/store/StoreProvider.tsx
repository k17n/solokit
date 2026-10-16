'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createIndexedDbStore, createMemoryStore, isOutdatedStoreError, type DataStore } from '@solokit/storage';
import { Button, Notice } from '@solokit/ui';

export interface StoreState {
  store: DataStore | null;
  /** False when the browser blocked IndexedDB and data will be lost on reload. Check `ready` first. */
  persistent: boolean;
  /** True once the store has been created and probed. Until then `store` is null. */
  ready: boolean;
  /** True when SoloKit was updated since this page loaded, so nothing more can be saved until the page is reloaded. */
  outdated: boolean;
}

const INITIAL: StoreState = { store: null, persistent: false, ready: false, outdated: false };
const StoreContext = createContext<StoreState>(INITIAL);

export interface StoreProviderProps {
  children: ReactNode;
  /** Read once, when the provider mounts. Later changes of this prop are ignored. */
  factory?: () => DataStore;
  /** What the Reload button does. Default: reload the page. */
  reload?: () => void;
}

/** Tells the provider when a request fails because the database was upgraded by a newer SoloKit, then passes the failure on. */
function watchForUpgrade(store: DataStore, onOutdated: () => void): DataStore {
  const watch = <A extends unknown[], R>(call: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await call(...args);
      } catch (error) {
        if (isOutdatedStoreError(error)) onOutdated();
        throw error;
      }
    };
  return {
    get: watch(store.get.bind(store)),
    put: watch(store.put.bind(store)),
    list: watch(store.list.bind(store)),
    remove: watch(store.remove.bind(store)),
    exportAll: watch(store.exportAll.bind(store)),
    importAll: watch(store.importAll.bind(store)),
  } as DataStore;
}

export function OutdatedNotice({ reload }: { reload: () => void }) {
  return (
    <div role="alert" style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
      <Notice tone="danger" title="Saving is paused">
        SoloKit was updated. Reload this page to keep saving.
      </Notice>
      <div>
        <Button onClick={reload}>Reload</Button>
      </div>
    </div>
  );
}

const reloadPage = () => window.location.reload();

export function StoreProvider({ children, factory = createIndexedDbStore, reload = reloadPage }: StoreProviderProps) {
  const [state, setState] = useState<StoreState>(INITIAL);
  const factoryRef = useRef(factory);

  useEffect(() => {
    let cancelled = false;
    const markOutdated = () => {
      if (!cancelled) setState((current) => (current.outdated ? current : { ...current, outdated: true }));
    };
    (async () => {
      let next: StoreState;
      try {
        const store = watchForUpgrade(factoryRef.current(), markOutdated);
        await store.list('settings');
        next = { store, persistent: true, ready: true, outdated: false };
      } catch (error) {
        if (isOutdatedStoreError(error)) {
          // The saved data belongs to a newer SoloKit than this page. Writing to a temporary copy would hide that, so ask for a reload.
          console.warn('SoloKit was updated since this page loaded.', error);
          next = { store: null, persistent: false, ready: true, outdated: true };
        } else {
          console.warn('SoloKit could not open browser storage; falling back to temporary memory.', error);
          next = { store: createMemoryStore(), persistent: false, ready: true, outdated: false };
        }
      }
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When the store could not be opened at all because of an update, there is nothing the tools could show or save.
  if (state.outdated && state.store === null) return <OutdatedNotice reload={reload} />;
  return (
    <StoreContext.Provider value={state}>
      {state.outdated ? <OutdatedNotice reload={reload} /> : null}
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreState {
  return useContext(StoreContext);
}
