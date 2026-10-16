import { IDBFactory } from 'fake-indexeddb';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIndexedDbStore, createWorkspaceManager, type WorkspaceManager } from '@solokit/storage';
import { WorkspaceProvider, useStorage, useWorkspaces, type WorkspacesState } from './WorkspaceProvider';
import { useStore } from '../store/StoreProvider';

afterEach(() => vi.restoreAllMocks());

const names = (state: WorkspacesState) => state.workspaces.map((workspace) => workspace.name).join(', ');

let latest: WorkspacesState;

function Probe() {
  const workspaces = useWorkspaces();
  const { ready, persistent, workspace, store } = useStorage();
  latest = workspaces;
  return (
    <div>
      <p>
        {ready ? 'store ready' : 'store loading'} / {persistent ? 'persistent' : 'temporary'} / {workspace?.name ?? 'no business'}
      </p>
      <p>list: {names(workspaces)}</p>
      <button type="button" onClick={() => void store?.put('clients', { id: 'c1', name: `in ${workspace?.name}` } as never)}>
        save client
      </button>
      <Clients />
    </div>
  );
}

function Clients() {
  const { store } = useStore();
  return (
    <button
      type="button"
      onClick={async () => {
        const clients = await store?.list<{ id: string; name: string }>('clients');
        document.title = (clients ?? []).map((client) => client.name).join('|') || 'none';
      }}
    >
      read clients
    </button>
  );
}

function setup(seed?: (factory: IDBFactory) => Promise<void>) {
  const factory = new IDBFactory();
  let ids = 0;
  const make = (): WorkspaceManager => createWorkspaceManager({ factory, storage: null, newId: () => `w${++ids}`, deleteTimeoutMs: 200 });
  const manager = make();
  return { factory, make, manager, ready: seed ? seed(factory) : Promise.resolve() };
}

describe('WorkspaceProvider', () => {
  it('shows nothing ready until the current business is known, then provides its store', async () => {
    const { manager } = setup();
    render(
      <WorkspaceProvider manager={manager}>
        <Probe />
      </WorkspaceProvider>,
    );
    expect(screen.getByText('store loading / temporary / no business')).toBeInTheDocument();
    expect(await screen.findByText('store ready / persistent / My business')).toBeInTheDocument();
    expect(latest.ready).toBe(true);
  });

  it('opens the existing database as the first business, named from the saved profile', async () => {
    const { manager, factory } = setup();
    const old = createIndexedDbStore({ name: 'solokit', factory });
    await old.put('profile', { id: 'me', name: 'Asha Rao Consulting' } as never);
    await old.put('clients', { id: 'c0', name: 'Existing client' } as never);
    await old.close();
    render(
      <WorkspaceProvider manager={manager}>
        <Probe />
      </WorkspaceProvider>,
    );
    expect(await screen.findByText('store ready / persistent / Asha Rao Consulting')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'read clients' }));
    await waitFor(() => expect(document.title).toBe('Existing client'));
  });

  it('switches business, giving each its own data', async () => {
    const { manager } = setup();
    render(
      <WorkspaceProvider manager={manager}>
        <Probe />
      </WorkspaceProvider>,
    );
    await screen.findByText('store ready / persistent / My business');
    await userEvent.click(screen.getByRole('button', { name: 'save client' }));

    await act(async () => {
      await latest.create('Studio Two');
    });
    expect(await screen.findByText('store ready / persistent / Studio Two')).toBeInTheDocument();
    expect(screen.getByText('list: My business, Studio Two')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'read clients' }));
    await waitFor(() => expect(document.title).toBe('none'));

    await act(async () => {
      await latest.switchTo(latest.workspaces[0]!.id);
    });
    await screen.findByText('store ready / persistent / My business');
    await userEvent.click(screen.getByRole('button', { name: 'read clients' }));
    await waitFor(() => expect(document.title).toBe('in My business'));
  });

  it('can create without switching, rename, archive and delete', async () => {
    const { manager } = setup();
    render(
      <WorkspaceProvider manager={manager}>
        <Probe />
      </WorkspaceProvider>,
    );
    await screen.findByText('store ready / persistent / My business');
    let second = latest.workspaces[0]!;
    await act(async () => {
      second = await latest.create('Second', { switchTo: false });
    });
    expect(screen.getByText('store ready / persistent / My business')).toBeInTheDocument();
    expect(screen.getByText('list: My business, Second')).toBeInTheDocument();

    await act(async () => latest.rename(second.id, 'Renamed'));
    expect(await screen.findByText('list: My business, Renamed')).toBeInTheDocument();

    await act(async () => latest.archive(second.id));
    await waitFor(() => expect(latest.workspaces[1]?.archivedAt).toBeDefined());
    await act(async () => latest.unarchive(second.id));
    await waitFor(() => expect(latest.workspaces[1]?.archivedAt).toBeUndefined());

    await act(async () => latest.remove(second.id));
    expect(await screen.findByText('list: My business')).toBeInTheDocument();
    await act(async () => {
      await expect(latest.remove(latest.workspaces[0]!.id)).rejects.toMatchObject({ code: 'last-active' });
    });
  });

  it('follows another tab: its new business appears, and deleting the current one moves the tool on', async () => {
    const { manager, make } = setup();
    render(
      <WorkspaceProvider manager={manager}>
        <Probe />
      </WorkspaceProvider>,
    );
    await screen.findByText('store ready / persistent / My business');
    const otherTab = make();
    const created = await otherTab.create('From another tab');
    expect(await screen.findByText('list: My business, From another tab')).toBeInTheDocument();

    await act(async () => latest.switchTo(created.id));
    await screen.findByText('store ready / persistent / From another tab');
    await otherTab.remove(created.id);
    expect(await screen.findByText('store ready / persistent / My business')).toBeInTheDocument();
    expect(screen.getByText('list: My business')).toBeInTheDocument();
    await otherTab.close();
  });

  it('works without IndexedDB, in temporary memory', async () => {
    const manager = createWorkspaceManager({ factory: null, storage: null, broadcast: false });
    render(
      <WorkspaceProvider manager={manager}>
        <Probe />
      </WorkspaceProvider>,
    );
    expect(await screen.findByText(/store ready/)).toBeInTheDocument();
    expect(latest.registryPersistent).toBe(false);
  });

  it('useWorkspaces outside a provider is an error, useStorage is not', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bare() {
      return <p>{useStorage().workspace === null ? 'no workspace' : 'workspace'}</p>;
    }
    render(<Bare />);
    expect(screen.getByText('no workspace')).toBeInTheDocument();
    function Wrong() {
      useWorkspaces();
      return null;
    }
    expect(() => render(<Wrong />)).toThrow('inside a WorkspaceProvider');
  });
});
