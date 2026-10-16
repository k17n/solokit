import { createIndexedDbStore, type IndexedDbStore } from './idb-store';
import { createMemoryStore } from './memory-store';
import { StorageBlockedError, StorageError, type DataStore } from './types';

/**
 * Business workspaces. Every Business keeps its data in its own IndexedDB database, and a small separate database
 * (`solokit-workspaces`) lists them. The database SoloKit used before workspaces existed (`solokit`) becomes the first
 * Business without any copying.
 */

export const REGISTRY_DB_NAME = 'solokit-workspaces';
export const LEGACY_DB_NAME = 'solokit';
export const DEFAULT_WORKSPACE_ID = 'default';
export const DEFAULT_WORKSPACE_NAME = 'My business';
export const CURRENT_WORKSPACE_KEY = 'solokit-current-workspace';
export const WORKSPACE_CHANNEL = 'solokit-workspaces';
const MAX_NAME_LENGTH = 80;

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** The IndexedDB database holding this Business's data. */
  dbName: string;
  archivedAt?: string;
}

export type WorkspaceErrorCode = 'last-active' | 'not-found' | 'invalid-name' | 'archived';

export class WorkspaceError extends StorageError {
  readonly code: WorkspaceErrorCode;
  constructor(code: WorkspaceErrorCode, message: string) {
    super(message);
    this.name = 'WorkspaceError';
    this.code = code;
  }
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface WorkspaceManagerOptions {
  /** The IndexedDB to use. `null` forces everything into memory. Default: the browser's. */
  factory?: IDBFactory | null;
  now?: () => Date;
  /** Makes the id of a new Business (it becomes part of the database name, so keep it to letters, digits and dashes). */
  newId?: () => string;
  /** Where the current Business is remembered synchronously. `null` disables it. Default: localStorage when it works. */
  storage?: KeyValueStorage | null;
  registryName?: string;
  legacyDbName?: string;
  /** How long a delete may wait for another tab to let go of the database before it fails. Default 5 seconds. */
  deleteTimeoutMs?: number;
  /** Set to false to skip the cross-tab notifications. */
  broadcast?: boolean;
}

export type WorkspaceListener = () => void;

export interface WorkspaceManager {
  /** False when the registry could not be kept on this device (memory fallback): Businesses made now are lost on reload. */
  readonly persistent: boolean;
  /** Every Business, active and archived, oldest first. Creates the first one if there is none. */
  list(): Promise<Workspace[]>;
  /** The Business to show: the remembered one if it still exists and is not archived, else the oldest active one. */
  current(): Promise<Workspace>;
  setCurrent(id: string): Promise<void>;
  create(name: string): Promise<Workspace>;
  rename(id: string, name: string): Promise<Workspace>;
  /** Hides a Business from the switcher without touching its data. Refuses the last active one. */
  archive(id: string): Promise<Workspace>;
  unarchive(id: string): Promise<Workspace>;
  /** Deletes the Business and its database for good. Refuses the last active one. */
  remove(id: string): Promise<void>;
  /** The Business's store. The same instance is returned until the Business is deleted or the manager is closed. */
  openStore(id: string): Promise<DataStore>;
  /** Called when another tab changed the list (created, renamed, archived, deleted, switched). Returns the unsubscribe function. */
  subscribe(listener: WorkspaceListener): () => void;
  /** Closes every connection (registry and stores). */
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------------------------------------------------
// Registry backends

interface RegistryBackend {
  readonly persistent: boolean;
  all(): Promise<Workspace[]>;
  put(workspace: Workspace): Promise<void>;
  delete(id: string): Promise<void>;
  /** Adds the workspace only if the registry is empty, in one step, so two tabs starting together make one. Returns whether it added. */
  putIfEmpty(workspace: Workspace): Promise<boolean>;
  getCurrent(): Promise<string | undefined>;
  setCurrent(id: string): Promise<void>;
  close(): void;
}

function memoryBackend(): RegistryBackend {
  const rows = new Map<string, Workspace>();
  let currentId: string | undefined;
  return {
    persistent: false,
    all: async () => [...rows.values()].map((row) => ({ ...row })),
    put: async (workspace) => void rows.set(workspace.id, { ...workspace }),
    delete: async (id) => void rows.delete(id),
    async putIfEmpty(workspace) {
      if (rows.size > 0) return false;
      rows.set(workspace.id, { ...workspace });
      return true;
    },
    getCurrent: async () => currentId,
    setCurrent: async (id) => void (currentId = id),
    close() {},
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new StorageError(request.error?.message ?? 'IndexedDB request failed'));
  });
}

function transactionComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new StorageError(tx.error?.message ?? 'IndexedDB transaction failed'));
    tx.onabort = () => reject(new StorageError(tx.error?.message ?? 'IndexedDB transaction aborted'));
  });
}

function openRegistry(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    try {
      const request = factory.open(name, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('workspaces', { keyPath: 'id' });
        request.result.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onsuccess = () => {
        if (settled) return request.result.close();
        settled = true;
        resolve(request.result);
      };
      request.onerror = () => {
        if (settled) return;
        settled = true;
        reject(new StorageError(request.error?.message ?? 'Could not open the workspace list'));
      };
      request.onblocked = () => {
        if (settled) return;
        settled = true;
        reject(new StorageBlockedError());
      };
    } catch (error) {
      settled = true;
      reject(new StorageError(`Could not open the workspace list: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
}

function idbBackend(factory: IDBFactory, name: string): { open(): Promise<RegistryBackend> } {
  return {
    async open() {
      let opening: Promise<IDBDatabase> | undefined;
      const database = () => {
        if (!opening) {
          const attempt = openRegistry(factory, name).then(
            (db) => {
              // Another tab wants to upgrade or delete this database: let go, and open again on the next request.
              db.onversionchange = () => {
                db.close();
                if (opening === attempt) opening = undefined;
              };
              db.onclose = () => {
                if (opening === attempt) opening = undefined;
              };
              return db;
            },
            (error) => {
              if (opening === attempt) opening = undefined;
              throw error;
            },
          );
          opening = attempt;
        }
        return opening;
      };
      await database(); // Fail now, so the caller can fall back to memory.
      return {
        persistent: true,
        async all() {
          const db = await database();
          return (await requestResult(db.transaction('workspaces').objectStore('workspaces').getAll())) as Workspace[];
        },
        async put(workspace) {
          const db = await database();
          const tx = db.transaction('workspaces', 'readwrite');
          const done = transactionComplete(tx);
          tx.objectStore('workspaces').put(workspace);
          await done;
        },
        async delete(id) {
          const db = await database();
          const tx = db.transaction('workspaces', 'readwrite');
          const done = transactionComplete(tx);
          tx.objectStore('workspaces').delete(id);
          await done;
        },
        async putIfEmpty(workspace) {
          const db = await database();
          const tx = db.transaction('workspaces', 'readwrite');
          const done = transactionComplete(tx);
          const store = tx.objectStore('workspaces');
          const count = await requestResult(store.count());
          if (count > 0) {
            await done;
            return false;
          }
          store.put(workspace);
          await done;
          return true;
        },
        async getCurrent() {
          const db = await database();
          const row = (await requestResult(db.transaction('meta').objectStore('meta').get('current'))) as { value?: unknown } | undefined;
          return typeof row?.value === 'string' ? row.value : undefined;
        },
        async setCurrent(id) {
          const db = await database();
          const tx = db.transaction('meta', 'readwrite');
          const done = transactionComplete(tx);
          tx.objectStore('meta').put({ key: 'current', value: id });
          await done;
        },
        close() {
          const pending = opening;
          opening = undefined;
          void pending?.then((db) => db.close(), () => undefined);
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------

function deleteDatabase(factory: IDBFactory, name: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      action();
    };
    try {
      const request = factory.deleteDatabase(name);
      request.onsuccess = () => finish(resolve);
      request.onerror = () => finish(() => reject(new StorageError(request.error?.message ?? 'Could not delete the database')));
      // Blocked is not a failure yet: other tabs close their connection when they see the versionchange event, and the
      // delete then goes through. Give them a moment before giving up.
      request.onblocked = () => {
        if (timer === undefined) timer = setTimeout(() => finish(() => reject(new StorageBlockedError('Another tab is still using this Business. Close it and try again.'))), timeoutMs);
      };
    } catch (error) {
      finish(() => reject(new StorageError(`Could not delete the database: ${error instanceof Error ? error.message : String(error)}`)));
    }
  });
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function defaultFactory(): IDBFactory | null {
  try {
    return globalThis.indexedDB ?? null;
  } catch {
    return null;
  }
}

function defaultNewId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? uuid.replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14).padEnd(12, '0');
}

function cleanName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (trimmed === '') throw new WorkspaceError('invalid-name', 'Enter a name for the business');
  if (trimmed.length > MAX_NAME_LENGTH) throw new WorkspaceError('invalid-name', `Use at most ${MAX_NAME_LENGTH} characters for the name`);
  return trimmed;
}

/** Oldest first. The first Business (the pre-existing database) wins a tie on the clock. */
const byAge = (a: Workspace, b: Workspace) =>
  a.createdAt.localeCompare(b.createdAt) || Number(b.id === DEFAULT_WORKSPACE_ID) - Number(a.id === DEFAULT_WORKSPACE_ID) || a.id.localeCompare(b.id);

export function createWorkspaceManager(options: WorkspaceManagerOptions = {}): WorkspaceManager {
  const factory = options.factory === undefined ? defaultFactory() : options.factory;
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? defaultNewId;
  const local = options.storage === undefined ? defaultStorage() : options.storage;
  const registryName = options.registryName ?? REGISTRY_DB_NAME;
  const legacyDbName = options.legacyDbName ?? LEGACY_DB_NAME;
  const deleteTimeoutMs = options.deleteTimeoutMs ?? 5000;
  const canBroadcast = options.broadcast !== false && typeof BroadcastChannel !== 'undefined';

  let backendPromise: Promise<RegistryBackend> | undefined;
  /** Optimistic until the registry has been opened; false afterwards if it fell back to memory. */
  let persistentFlag = factory !== null;
  const stores = new Map<string, DataStore>();
  const listeners = new Set<WorkspaceListener>();
  let channel: BroadcastChannel | undefined;

  const stamp = () => now().toISOString();

  function rememberLocally(id: string | null) {
    try {
      if (id === null) local?.removeItem(CURRENT_WORKSPACE_KEY);
      else local?.setItem(CURRENT_WORKSPACE_KEY, id);
    } catch {
      // It is only a convenience.
    }
  }

  function recalled(): string | undefined {
    try {
      return local?.getItem(CURRENT_WORKSPACE_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  }

  function announce() {
    if (!canBroadcast) return;
    try {
      const sender = new BroadcastChannel(WORKSPACE_CHANNEL);
      sender.postMessage({ type: 'changed' });
      sender.close();
    } catch {
      // Other tabs will see the change the next time they read the list.
    }
  }

  function openStoreFor(workspace: Workspace): DataStore {
    return factory ? createIndexedDbStore({ name: workspace.dbName, factory }) : createMemoryStore();
  }

  /** The saved business name in the old database, for naming the first Business. Never throws. */
  async function legacyBusinessName(): Promise<string> {
    if (!factory) return DEFAULT_WORKSPACE_NAME;
    const probe = createIndexedDbStore({ name: legacyDbName, factory });
    try {
      const profile = await probe.get<{ id: string; name?: unknown }>('profile', 'me');
      const name = typeof profile?.name === 'string' ? profile.name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH) : '';
      return name === '' ? DEFAULT_WORKSPACE_NAME : name;
    } catch {
      return DEFAULT_WORKSPACE_NAME;
    } finally {
      await probe.close();
    }
  }

  async function createBackend(): Promise<RegistryBackend> {
    let backend: RegistryBackend;
    try {
      backend = factory ? await idbBackend(factory, registryName).open() : memoryBackend();
    } catch (error) {
      console.warn('SoloKit could not open its list of businesses; using temporary memory for the list.', error);
      backend = memoryBackend();
    }
    // The first Business is the existing database. This runs once per empty registry and is a no-op afterwards.
    try {
      if ((await backend.all()).length === 0) {
        const name = await legacyBusinessName();
        const stampNow = stamp();
        await backend.putIfEmpty({ id: DEFAULT_WORKSPACE_ID, name, createdAt: stampNow, updatedAt: stampNow, dbName: legacyDbName });
      }
    } catch (error) {
      // The registry cannot be written. Keep going with a memory list that still points at the existing data.
      console.warn('SoloKit could not save its list of businesses; using temporary memory for the list.', error);
      backend.close();
      backend = memoryBackend();
      const stampNow = stamp();
      await backend.put({ id: DEFAULT_WORKSPACE_ID, name: DEFAULT_WORKSPACE_NAME, createdAt: stampNow, updatedAt: stampNow, dbName: legacyDbName });
    }
    return backend;
  }

  const registry = (): Promise<RegistryBackend> => {
    backendPromise ??= createBackend().then(
      (backend) => {
        persistentFlag = backend.persistent && factory !== null;
        return backend;
      },
      (error) => {
        backendPromise = undefined;
        throw error;
      },
    );
    return backendPromise;
  };

  async function getRow(id: string): Promise<Workspace> {
    const found = (await (await registry()).all()).find((row) => row.id === id);
    if (!found) throw new WorkspaceError('not-found', 'That business no longer exists');
    return found;
  }

  async function update(id: string, change: (row: Workspace) => Workspace): Promise<Workspace> {
    const next = { ...change(await getRow(id)), updatedAt: stamp() };
    await (await registry()).put(next);
    announce();
    return next;
  }

  async function activeOtherThan(id: string): Promise<Workspace[]> {
    return (await (await registry()).all()).filter((row) => row.id !== id && row.archivedAt === undefined);
  }

  async function closeStore(id: string): Promise<void> {
    const open = stores.get(id);
    stores.delete(id);
    await (open as Partial<IndexedDbStore> | undefined)?.close?.();
  }

  const manager: WorkspaceManager = {
    get persistent() {
      return persistentFlag;
    },

    async list() {
      return (await (await registry()).all()).sort(byAge);
    },

    async current() {
      const backend = await registry();
      const active = (await backend.all()).filter((row) => row.archivedAt === undefined).sort(byAge);
      const wanted = (await backend.getCurrent().catch(() => undefined)) ?? recalled();
      const found = active.find((row) => row.id === wanted) ?? active[0];
      if (!found) throw new WorkspaceError('not-found', 'There is no active business');
      return found;
    },

    async setCurrent(id) {
      const row = await getRow(id);
      if (row.archivedAt !== undefined) throw new WorkspaceError('archived', 'That business is archived');
      rememberLocally(id);
      await (await registry()).setCurrent(id);
      announce();
    },

    async create(name) {
      const clean = cleanName(name);
      const backend = await registry();
      const id = newId();
      const stampNow = stamp();
      const row: Workspace = { id, name: clean, createdAt: stampNow, updatedAt: stampNow, dbName: `solokit-ws-${id}` };
      if ((await backend.all()).some((other) => other.id === id)) throw new StorageError('A business with this id already exists');
      await backend.put(row);
      announce();
      return row;
    },

    rename: async (id, name) => {
      const clean = cleanName(name);
      return update(id, (row) => ({ ...row, name: clean }));
    },

    async archive(id) {
      const row = await getRow(id);
      if (row.archivedAt === undefined && (await activeOtherThan(id)).length === 0) {
        throw new WorkspaceError('last-active', 'You need at least one business. Create another before archiving this one.');
      }
      return update(id, (current) => ({ ...current, archivedAt: current.archivedAt ?? stamp() }));
    },

    unarchive: (id) =>
      update(id, (row) => {
        const { archivedAt: _archived, ...rest } = row;
        return rest;
      }),

    async remove(id) {
      const row = await getRow(id);
      const others = await activeOtherThan(id);
      if (row.archivedAt === undefined && others.length === 0) {
        throw new WorkspaceError('last-active', 'You need at least one business. Create another before deleting this one.');
      }
      // Let go of our own connection first, or the delete would wait on us.
      await closeStore(id);
      if (factory) await deleteDatabase(factory, row.dbName, deleteTimeoutMs);
      const backend = await registry();
      await backend.delete(id);
      const wanted = (await backend.getCurrent().catch(() => undefined)) ?? recalled();
      if (wanted === id) {
        const next = others.sort(byAge)[0];
        if (next) {
          rememberLocally(next.id);
          await backend.setCurrent(next.id).catch(() => undefined);
        } else {
          rememberLocally(null);
        }
      }
      announce();
    },

    async openStore(id) {
      const existing = stores.get(id);
      if (existing) return existing;
      const store = openStoreFor(await getRow(id));
      stores.set(id, store);
      return store;
    },

    subscribe(listener) {
      listeners.add(listener);
      if (canBroadcast && !channel) {
        try {
          channel = new BroadcastChannel(WORKSPACE_CHANNEL);
          (channel as unknown as { unref?: () => void }).unref?.();
          channel.onmessage = () => {
            for (const notify of [...listeners]) notify();
          };
        } catch {
          channel = undefined;
        }
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && channel) {
          channel.close();
          channel = undefined;
        }
      };
    },

    async close() {
      channel?.close();
      channel = undefined;
      listeners.clear();
      await Promise.all([...stores.keys()].map(closeStore));
      const pending = backendPromise;
      backendPromise = undefined;
      (await pending?.catch(() => undefined))?.close();
    },
  };

  return manager;
}
