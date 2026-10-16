'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createWorkspaceManager, type DataStore, type Workspace, type WorkspaceManager } from '@solokit/storage';
import { StoreProvider, useStore, type StoreState } from '../store/StoreProvider';

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
  create(name: string, options?: { switchTo?: boolean }): Promise<Workspace>;
  rename(id: string, name: string): Promise<void>;
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

const WorkspacesContext = createContext<WorkspacesState | null>(null);

export interface WorkspaceProviderProps {
  children: ReactNode;
  /** Read once, when the provider mounts. Tests pass one over fake-indexeddb or memory; the default uses the browser's IndexedDB. */
  manager?: WorkspaceManager;
  /** Passed to the store provider: what the Reload button does after SoloKit was updated. */
  reload?: () => void;
}

interface Loaded {
  workspaces: Workspace[];
  current: Workspace;
  store: DataStore;
  registryPersistent: boolean;
}

/**
 * Owns the list of Businesses and shows the tool over the current Business's store. It mounts the store provider keyed
 * by the Business, so switching Business replaces the whole tool and `useStore()` keeps working unchanged inside it.
 * Another tab's changes (a Business created, renamed, archived, deleted or switched) arrive through the manager and
 * refresh the list; if the current Business was deleted there, the tool moves to the next one.
 */
export function WorkspaceProvider({ children, manager: provided, reload }: WorkspaceProviderProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const managerRef = useRef<WorkspaceManager | null>(provided ?? null);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const manager = managerRef.current;
    if (!manager) return;
    const ticket = ++latest.current;
    const [workspaces, current] = await Promise.all([manager.list(), manager.current()]);
    const store = await manager.openStore(current.id);
    // A newer refresh has started; its answer is the one to keep.
    if (ticket === latest.current) setLoaded({ workspaces, current, store, registryPersistent: manager.persistent });
  }, []);

  useEffect(() => {
    const manager = (managerRef.current ??= createWorkspaceManager());
    let cancelled = false;
    const load = () =>
      refresh().catch((error: unknown) => {
        console.warn('SoloKit could not read its list of businesses.', error);
        if (!cancelled) setFailed(true);
      });
    void load();
    const unsubscribe = manager.subscribe(() => void load());
    return () => {
      cancelled = true;
      unsubscribe();
      latest.current++;
      // A manager passed in belongs to the caller. Closing one made here releases its database connections.
      if (!provided) {
        void manager.close();
        managerRef.current = null;
      }
    };
  }, [provided, refresh]);

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
        const created = await manager.create(name);
        if (options.switchTo !== false) await manager.setCurrent(created.id);
        await refresh();
        return created;
      },
      async rename(id, name) {
        await manager.rename(id, name);
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

  const storeFactory = useMemo(() => (loaded ? () => loaded.store : undefined), [loaded]);

  return (
    <WorkspacesContext.Provider value={value}>
      {/* A failure to read the list at all: fall back to the tool's own temporary store rather than a blank page. */}
      <StoreProvider
        key={failed ? 'failed' : (loaded?.current.id ?? 'pending')}
        pending={!loaded && !failed}
        {...(storeFactory ? { factory: storeFactory } : {})}
        {...(reload ? { reload } : {})}
      >
        {children}
      </StoreProvider>
    </WorkspacesContext.Provider>
  );
}

/** The list of Businesses and the actions on it. Must be used inside {@link WorkspaceProvider}. */
export function useWorkspaces(): WorkspacesState {
  const value = useContext(WorkspacesContext);
  if (!value) throw new Error('useWorkspaces must be used inside a WorkspaceProvider');
  return value;
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
