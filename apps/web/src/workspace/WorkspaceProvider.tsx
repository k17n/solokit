'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createWorkspaceManager, type DataStore, type Workspace, type WorkspaceManager } from '@solokit/storage';
import { Button, Notice } from '@solokit/ui';
import { StoreProvider, useStore, type StoreState } from '../store/StoreProvider';
import { UnsavedGuardProvider } from './unsavedGuard';

export interface WorkspacesState {
  /** True once the list of Businesses has been read. Until then `workspaces` is empty and `current` is null. */
  ready: boolean;
  /** Every Business, active and archived, oldest first. */
  workspaces: Workspace[];
  /** The Business being shown. */
  current: Workspace | null;
  /** False when the list of Businesses could not be saved on this device (temporary memory), so new Businesses are lost on reload. */
  registryPersistent: boolean;
  /** Shows another Business. The tool on screen is replaced, so anything unsaved in it is gone. */
  switchTo(id: string): Promise<void>;
  /** Creates a Business. By default it becomes the current one. */
  create(name: string, options?: { switchTo?: boolean; nameInSync?: boolean }): Promise<Workspace>;
  /** Renames a Business. `keepInSync` says the rename only follows the profile name, so the name keeps following it. */
  rename(id: string, name: string, options?: { keepInSync?: boolean }): Promise<void>;
  archive(id: string): Promise<void>;
  unarchive(id: string): Promise<void>;
  /** Deletes a Business and all its data for good. Refuses the last one. The UI must ask twice. */
  remove(id: string): Promise<void>;
  /** The manager, for the data-layer helpers that take one (for example restoring a backup into a new Business). */
  manager: WorkspaceManager | null;
  /** Re-reads the list. Other tabs' changes arrive on their own. */
  refresh(): Promise<void>;
}

const NOT_READY = async (): Promise<never> => {
  throw new Error('The businesses are still loading');
};

const INITIAL: WorkspacesState = {
  ready: false,
  workspaces: [],
  current: null,
  registryPersistent: false,
  switchTo: NOT_READY,
  create: NOT_READY,
  rename: NOT_READY,
  archive: NOT_READY,
  unarchive: NOT_READY,
  remove: NOT_READY,
  manager: null,
  refresh: async () => {},
};

interface Loaded {
  workspaces: Workspace[];
  current: Workspace;
  store: DataStore;
  /** Changes whenever the store behind the Business is a different one, so everything inside is rebuilt. */
  storeKey: string;
  /** False when the stores keep their data in memory only. */
  storePersistent: boolean;
  registryPersistent: boolean;
}

/** What {@link WorkspaceStore} needs: the current Business's store, or the fact that the list could not be read. */
interface StoreSource {
  loaded: Loaded | null;
  failed: boolean;
  retry(): void;
}

const WorkspacesContext = createContext<WorkspacesState | null>(null);
const StoreSourceContext = createContext<StoreSource | null>(null);

export interface WorkspacesProviderProps {
  children: ReactNode;
  /** Read once, when the provider mounts. Tests pass one over fake-indexeddb or memory; the default uses the browser's IndexedDB. */
  manager?: WorkspaceManager;
  /**
   * False: nothing is read or created yet (the home page, which uses no Business). It starts loading the first time this
   * becomes true and keeps what it loaded after that. Default true.
   */
  enabled?: boolean;
}

/**
 * Owns the list of Businesses. It sits above the page (header and all), so the Business switcher can live in the site
 * header; {@link WorkspaceStore} below it shows a tool over the current Business's store. Another tab's changes (a
 * Business created, renamed, archived, deleted or switched) arrive through the manager and refresh the list; if the
 * current Business was deleted there, the tool moves to the next one.
 */
export function WorkspacesProvider({ children, manager: provided, enabled = true }: WorkspacesProviderProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const loadRef = useRef<() => Promise<void>>(async () => {});
  const managerRef = useRef<WorkspaceManager | null>(provided ?? null);
  const latest = useRef(0);
  /** Which build of the store each store instance got, so a different instance for the same Business also rebuilds the tool. */
  const storeKeys = useRef(new WeakMap<DataStore, number>());
  const storeCount = useRef(0);

  const refresh = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) return;
    const ticket = ++latest.current;
    const [workspaces, current] = await Promise.all([manager.list(), manager.current()]);
    const store = await manager.openStore(current.id);
    // A newer refresh has started; its answer is the one to keep.
    if (ticket !== latest.current) return;
    let build = storeKeys.current.get(store);
    if (build === undefined) {
      build = ++storeCount.current;
      storeKeys.current.set(store, build);
    }
    setLoaded({ workspaces, current, store, storeKey: `${current.id}:${build}`, storePersistent: manager.storesPersistent, registryPersistent: manager.persistent });
    // The list is readable again: an earlier failure is over.
    setFailed(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const manager = (managerRef.current ??= createWorkspaceManager());
    let cancelled = false;
    const load = () =>
      refresh().catch((error: unknown) => {
        console.warn('SoloKit could not read its list of businesses.', error);
        if (!cancelled) setFailed(true);
      });
    loadRef.current = load;
    void load();
    const unsubscribe = manager.subscribe(() => void load());
    return () => {
      cancelled = true;
      unsubscribe();
      latest.current++;
    };
  }, [enabled, refresh]);

  const retry = useCallback(() => {
    setFailed(false);
    void loadRef.current();
  }, []);

  useEffect(
    () => () => {
      // A manager passed in belongs to the caller. Closing one made here releases its database connections.
      if (!provided && managerRef.current) {
        void managerRef.current.close();
        managerRef.current = null;
      }
    },
    [provided],
  );

  const value = useMemo<WorkspacesState>(() => {
    const manager = managerRef.current;
    if (!loaded || !manager) return { ...INITIAL, manager };
    return {
      ready: true,
      workspaces: loaded.workspaces,
      current: loaded.current,
      registryPersistent: loaded.registryPersistent,
      manager,
      refresh,
      async switchTo(id) {
        await manager.setCurrent(id);
        await refresh();
      },
      async create(name, options = {}) {
        const created = await manager.create(name, options.nameInSync === true ? { nameInSync: true } : {});
        if (options.switchTo !== false) await manager.setCurrent(created.id);
        await refresh();
        return created;
      },
      async rename(id, name, options) {
        await manager.rename(id, name, options);
        await refresh();
      },
      async archive(id) {
        await manager.archive(id);
        await refresh();
      },
      async unarchive(id) {
        await manager.unarchive(id);
        await refresh();
      },
      async remove(id) {
        await manager.remove(id);
        await refresh();
      },
    };
  }, [loaded, refresh]);

  const source = useMemo<StoreSource>(() => ({ loaded, failed, retry }), [loaded, failed, retry]);

  return (
    <WorkspacesContext.Provider value={value}>
      <StoreSourceContext.Provider value={source}>
        <UnsavedGuardProvider>{children}</UnsavedGuardProvider>
      </StoreSourceContext.Provider>
    </WorkspacesContext.Provider>
  );
}

export interface WorkspaceStoreProps {
  children: ReactNode;
  /** Passed to the store provider: what the Reload button does after SoloKit was updated. */
  reload?: () => void;
}

/**
 * Shows its children over the current Business's store, keyed by the Business: switching Business replaces everything
 * inside, and `useStore()` keeps working unchanged. Outside a {@link WorkspacesProvider} it makes its own.
 */
export function WorkspaceStore({ children, reload }: WorkspaceStoreProps) {
  const source = useContext(StoreSourceContext);
  const loaded = source?.loaded ?? null;
  const storeFactory = useMemo(() => (loaded ? () => loaded.store : undefined), [loaded]);
  if (!source) return <WorkspaceProvider {...(reload ? { reload } : {})}>{children}</WorkspaceProvider>;
  // The Business could not be worked out. Never fall back to some default database: that would show, and write to,
  // data that may belong to another Business. Say so and let the person try again.
  if (!loaded && source.failed) {
    return (
      <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
        <Notice tone="danger" title="Your businesses could not be opened">
          Your browser could not read the list of businesses saved on this device, so nothing is shown and nothing is saved. Try again. If it keeps happening, reload the page.
        </Notice>
        <div>
          <Button onClick={source.retry}>Retry</Button>
        </div>
      </div>
    );
  }
  return (
    // Keyed by the Business and its store: whenever either changes, the tool is built again from scratch.
    <StoreProvider
      key={loaded?.storeKey ?? 'pending'}
      pending={!loaded}
      persistent={loaded?.storePersistent ?? true}
      {...(storeFactory ? { factory: storeFactory } : {})}
      {...(reload ? { reload } : {})}
    >
      {children}
    </StoreProvider>
  );
}

export interface WorkspaceProviderProps extends WorkspaceStoreProps {
  manager?: WorkspaceManager;
}

/** The list of Businesses and a tool over the current one, in one piece. Pages that already sit under a {@link WorkspacesProvider} use {@link WorkspaceStore}. */
export function WorkspaceProvider({ children, manager, reload }: WorkspaceProviderProps) {
  return (
    <WorkspacesProvider {...(manager ? { manager } : {})}>
      <WorkspaceStore {...(reload ? { reload } : {})}>{children}</WorkspaceStore>
    </WorkspacesProvider>
  );
}

/** The list of Businesses and the actions on it. Must be used inside {@link WorkspacesProvider} or {@link WorkspaceProvider}. */
export function useWorkspaces(): WorkspacesState {
  const value = useContext(WorkspacesContext);
  if (!value) throw new Error('useWorkspaces must be used inside a WorkspaceProvider');
  return value;
}

/** Like {@link useWorkspaces}, but null instead of an error outside a provider (screens that also run in tests without one). */
export function useOptionalWorkspaces(): WorkspacesState | null {
  return useContext(WorkspacesContext);
}

export interface StorageState extends StoreState {
  /** The Business whose data this store holds. Null outside a WorkspaceProvider or while loading. */
  workspace: Workspace | null;
}

/** The current Business's store, with the same fields `useStore()` has plus the Business itself. */
export function useStorage(): StorageState {
  const store = useStore();
  const workspaces = useContext(WorkspacesContext);
  return { ...store, workspace: workspaces?.current ?? null };
}
