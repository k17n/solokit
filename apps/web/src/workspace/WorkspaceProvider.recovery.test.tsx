import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeManager } from '../business/testWorkspaces';
import { useStore } from '../store/StoreProvider';
import { BusinessSwitcher } from './BusinessSwitcher';
import { WorkspaceProvider, WorkspacesProvider, WorkspaceStore, useWorkspaces, type WorkspacesState } from './WorkspaceProvider';

afterEach(() => vi.restoreAllMocks());

let latest: WorkspacesState;
let mounts = 0;

function Tool() {
  const { ready, persistent } = useStore();
  const workspaces = useWorkspaces();
  latest = workspaces;
  useEffect(() => {
    mounts += 1;
  }, []);
  return (
    <p>
      tool {ready ? 'ready' : 'loading'} / {persistent ? 'persistent' : 'temporary'} / {workspaces.current?.name ?? 'none'}
    </p>
  );
}

describe('WorkspaceProvider when the businesses cannot be read', () => {
  it('shows an error with Retry instead of the tool, and never falls back to a default database', async () => {
    const { manager } = makeManager();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const list = vi.spyOn(manager, 'list').mockRejectedValueOnce(new Error('registry unreadable'));
    const openStore = vi.spyOn(manager, 'openStore');
    render(
      <WorkspaceProvider manager={manager}>
        <Tool />
      </WorkspaceProvider>,
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your businesses could not be opened');
    // The tool is not on screen at all, so it cannot read or write some other database.
    expect(screen.queryByText(/^tool /)).not.toBeInTheDocument();
    expect(openStore).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('tool ready / persistent / My business')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('forgets the failure when a later refresh (another tab announcing a change) works', async () => {
    const { manager } = makeManager();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(manager, 'list').mockRejectedValueOnce(new Error('registry unreadable'));
    let announce: () => void = () => {};
    const subscribe = manager.subscribe.bind(manager);
    vi.spyOn(manager, 'subscribe').mockImplementation((listener) => {
      announce = listener;
      return subscribe(listener);
    });
    render(
      <WorkspaceProvider manager={manager}>
        <Tool />
      </WorkspaceProvider>,
    );
    await screen.findByRole('alert');
    act(() => announce());
    expect(await screen.findByText('tool ready / persistent / My business')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the tool it already has when only a later refresh fails, and recovers on the next one', async () => {
    const { manager } = makeManager();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let announce: () => void = () => {};
    const subscribe = manager.subscribe.bind(manager);
    vi.spyOn(manager, 'subscribe').mockImplementation((listener) => {
      announce = listener;
      return subscribe(listener);
    });
    render(
      <WorkspaceProvider manager={manager}>
        <Tool />
      </WorkspaceProvider>,
    );
    await screen.findByText('tool ready / persistent / My business');
    const list = vi.spyOn(manager, 'list').mockRejectedValueOnce(new Error('blip'));
    act(() => announce());
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(screen.getByText('tool ready / persistent / My business')).toBeInTheDocument();
    act(() => announce());
    await act(async () => {
      await latest.rename(latest.current!.id, 'Renamed');
    });
    expect(await screen.findByText('tool ready / persistent / Renamed')).toBeInTheDocument();
  });
});

describe('WorkspaceProvider rebuilds the tool when the business changes', () => {
  it('mounts the tool again for another business, but not for a rename of the same one', async () => {
    mounts = 0;
    const { manager } = makeManager();
    render(
      <WorkspaceProvider manager={manager}>
        <Tool />
      </WorkspaceProvider>,
    );
    await screen.findByText('tool ready / persistent / My business');
    const builtFirst = mounts;
    await act(async () => {
      await latest.rename(latest.current!.id, 'Renamed');
    });
    await screen.findByText('tool ready / persistent / Renamed');
    expect(mounts).toBe(builtFirst);

    await act(async () => {
      await latest.create('Studio Two');
    });
    await screen.findByText('tool ready / persistent / Studio Two');
    expect(mounts).toBeGreaterThan(builtFirst);
  });

  it('mounts the tool again when the same business is resolved to a different store', async () => {
    mounts = 0;
    const { manager } = makeManager();
    render(
      <WorkspaceProvider manager={manager}>
        <Tool />
      </WorkspaceProvider>,
    );
    await screen.findByText('tool ready / persistent / My business');
    const before = mounts;
    await act(async () => {
      await manager.release(latest.current!.id);
      await latest.refresh();
    });
    await waitFor(() => expect(mounts).toBeGreaterThan(before));
    expect(await screen.findByText('tool ready / persistent / My business')).toBeInTheDocument();
  });
});

describe('per-tab current business in the app', () => {
  it('does not move this tab when another tab switches, until its own business is deleted there', async () => {
    const { manager, factory } = makeManager();
    const { createWorkspaceManager } = await import('@solokit/storage');
    let ids = 100;
    const otherTab = createWorkspaceManager({ factory, storage: null, newId: () => `o${++ids}`, deleteTimeoutMs: 200, broadcast: false });
    render(
      <WorkspacesProvider manager={manager}>
        <header>
          <BusinessSwitcher />
        </header>
        <WorkspaceStore>
          <Tool />
        </WorkspaceStore>
      </WorkspacesProvider>,
    );
    await screen.findByText('tool ready / persistent / My business');
    const second = await otherTab.create('Studio Two');
    await otherTab.setCurrent(second.id);
    // The list learns about the new business, but this tab stays where it is.
    await act(async () => {
      await latest.refresh();
    });
    expect(latest.workspaces.map((workspace) => workspace.name)).toEqual(['My business', 'Studio Two']);
    expect(screen.getByText('tool ready / persistent / My business')).toBeInTheDocument();
    expect(latest.current?.id).toBe('default');

    await otherTab.archive('default');
    await act(async () => {
      await latest.refresh();
    });
    expect(await screen.findByText('tool ready / persistent / Studio Two')).toBeInTheDocument();
    await otherTab.close();
  });
});

describe('the last active business under a simultaneous archive', () => {
  it('lets one of two archives through and keeps a business on screen', async () => {
    const { manager, factory } = makeManager();
    const { createWorkspaceManager } = await import('@solokit/storage');
    const otherTab = createWorkspaceManager({ factory, storage: null, newId: () => 'o1', deleteTimeoutMs: 200, broadcast: false });
    render(
      <WorkspaceProvider manager={manager}>
        <Tool />
      </WorkspaceProvider>,
    );
    await screen.findByText('tool ready / persistent / My business');
    const second = await latest.create('Studio Two', { switchTo: false });
    const results = await Promise.allSettled([latest.archive('default'), otherTab.archive(second.id)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: { code: 'last-active' } });
    await act(async () => {
      await latest.refresh();
    });
    expect(latest.workspaces.filter((workspace) => workspace.archivedAt === undefined)).toHaveLength(1);
    expect(latest.current).not.toBeNull();
    await otherTab.close();
  });
});
