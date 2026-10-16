import { IDBFactory } from 'fake-indexeddb';
import { createWorkspaceManager, type WorkspaceManager } from '@solokit/storage';

/** A workspace manager over a private fake IndexedDB, with predictable ids (w1, w2, ...). */
export function makeManager(): { factory: IDBFactory; manager: WorkspaceManager } {
  const factory = new IDBFactory();
  let ids = 0;
  const manager = createWorkspaceManager({ factory, storage: null, newId: () => `w${++ids}`, deleteTimeoutMs: 200, broadcast: false });
  return { factory, manager };
}
