import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataStore } from '@solokit/storage';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeInvoice } from '@solokit/tool-invoice/testing';
import * as downloads from '../invoice/downloads';
import { WorkspacesProvider, useWorkspaces, type WorkspacesState } from '../workspace/WorkspaceProvider';
import { ManageBusinesses } from './ManageBusinesses';
import { makeManager } from './testWorkspaces';

let latest: WorkspacesState;

function Capture() {
  latest = useWorkspaces();
  return null;
}

async function setup() {
  const { manager } = makeManager();
  render(
    <WorkspacesProvider manager={manager}>
      <Capture />
      <ManageBusinesses now={() => new Date('2026-10-16T10:00:00Z')} />
    </WorkspacesProvider>,
  );
  await screen.findByRole('heading', { name: 'Your businesses' });
  await act(async () => {
    await latest.create('Studio Two', { switchTo: false });
  });
  await screen.findByRole('button', { name: 'Rename Studio Two' });
  return manager;
}

const row = (name: string) => screen.getAllByRole('listitem').find((item) => item.firstElementChild?.firstElementChild?.textContent === name) as HTMLElement;

beforeEach(() => {
  vi.spyOn(downloads, 'downloadBlob').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('ManageBusinesses', () => {
  it('lists every business with its state and explains what archive and delete do', async () => {
    await setup();
    expect(within(row('My business')).getByText('Current')).toBeInTheDocument();
    expect(screen.getByText(/Deleting erases it from this device only/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '+ Add a business' })).toHaveAttribute('href', '#add');
  });

  it('renames a business, focuses the rename button again, and reports an invalid name', async () => {
    await setup();
    await userEvent.click(within(row('Studio Two')).getByRole('button', { name: 'Rename Studio Two' }));
    const input = screen.getByLabelText('Business name');
    expect(input).toHaveFocus();
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Enter a name for the business')).toBeInTheDocument();
    await userEvent.type(input, '  Studio   Three ');
    await userEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Renamed to "Studio Three".')).toBeInTheDocument();
    expect(within(row('Studio Three')).getByRole('button', { name: 'Rename Studio Three' })).toHaveFocus();
  });

  it('switches to another business, and archives and unarchives one', async () => {
    await setup();
    await userEvent.click(within(row('Studio Two')).getByRole('button', { name: 'Switch to Studio Two' }));
    await waitFor(() => expect(within(row('Studio Two')).getByText('Current')).toBeInTheDocument());
    await userEvent.click(within(row('My business')).getByRole('button', { name: 'Archive My business' }));
    expect(await screen.findByText('"My business" is archived. Its data is kept.')).toBeInTheDocument();
    expect(within(row('My business')).getByText('Archived')).toBeInTheDocument();
    await userEvent.click(within(row('My business')).getByRole('button', { name: 'Unarchive My business' }));
    expect(await screen.findByText('"My business" is back in the switcher.')).toBeInTheDocument();
  });

  it('cannot archive or delete the only active business, and says why', async () => {
    const { manager } = makeManager();
    render(
      <WorkspacesProvider manager={manager}>
        <ManageBusinesses />
      </WorkspacesProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Delete My business' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Archive My business' })).toBeDisabled();
    expect(screen.getByText(/your only business/)).toBeInTheDocument();
  });

  it('deletes in two steps: a warning naming what is erased, then the business name typed in', async () => {
    const manager = await setup();
    const store = await manager.openStore('w1');
    await createInvoiceStorage(store).invoices.save(makeInvoice({ status: 'draft' }));
    await userEvent.click(within(row('Studio Two')).getByRole('button', { name: 'Delete Studio Two' }));
    const confirm = screen.getByRole('group', { name: /Delete .Studio Two. for good/ });
    expect(confirm).toHaveFocus();
    expect(confirm).toHaveTextContent('erases "Studio Two" from this device');
    await within(confirm).findByText(/1 invoice or quote/);
    const forever = within(confirm).getByRole('button', { name: /forever/ });
    expect(forever).toBeDisabled();
    await userEvent.type(within(confirm).getByLabelText(/Type the business name/), 'studio two');
    expect(forever).toBeDisabled();
    await userEvent.clear(within(confirm).getByLabelText(/Type the business name/));
    await userEvent.type(within(confirm).getByLabelText(/Type the business name/), 'Studio Two');
    await userEvent.click(forever);
    expect(await screen.findByText('Deleted "Studio Two" from this device.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename Studio Two' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your businesses' })).toHaveFocus();
    expect(latest.workspaces.map((workspace) => workspace.name)).toEqual(['My business']);
  });

  it('counts what is in the business, and can back it up first', async () => {
    const manager = await setup();
    const store = await manager.openStore('w1');
    await createInvoiceStorage(store).invoices.save(makeInvoice({ id: 'i1', status: 'issued' }));
    await userEvent.click(within(row('Studio Two')).getByRole('button', { name: 'Delete Studio Two' }));
    expect(await screen.findByText(/1 invoice or quote/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Download a backup of this business first' }));
    expect(await screen.findByText(/A backup of .Studio Two. was downloaded/)).toBeInTheDocument();
    expect(downloads.downloadBlob).toHaveBeenCalledOnce();
    const blob = vi.mocked(downloads.downloadBlob).mock.calls[0]![0] as Blob;
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    expect(JSON.parse(text).workspace).toEqual({ name: 'Studio Two' });
  });

  it('Keep it closes the warning and returns focus to the Delete button', async () => {
    await setup();
    await userEvent.click(within(row('Studio Two')).getByRole('button', { name: 'Delete Studio Two' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByRole('group', { name: /for good/ })).not.toBeInTheDocument();
    expect(within(row('Studio Two')).getByRole('button', { name: 'Delete Studio Two' })).toHaveFocus();
    expect(latest.workspaces).toHaveLength(2);
  });

  it('ignores a slow count that arrives after the person moved on, and lets go of the connection it opened', async () => {
    const manager = await setup();
    await act(async () => {
      await latest.create('Studio Three', { switchTo: false });
    });
    const two = createInvoiceStorage(await manager.openStore('w1'));
    await two.invoices.save(makeInvoice({ id: 'a', status: 'issued' }));
    const three = createInvoiceStorage(await manager.openStore('w2'));
    await three.invoices.save(makeInvoice({ id: 'b', number: '2026-27/0002', status: 'issued' }));
    await three.invoices.save(makeInvoice({ id: 'c', number: '2026-27/0003', status: 'issued' }));
    await manager.release('w1');
    await manager.release('w2');

    let openGate: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const real = manager.openStore.bind(manager);
    vi.spyOn(manager, 'openStore').mockImplementation(async (id) => {
      const store = await real(id);
      if (id !== 'w1') return store;
      return { ...store, list: async (collection) => (await gate, store.list(collection)) } as DataStore;
    });
    const release = vi.spyOn(manager, 'release');
    const releasedTwo = () => release.mock.calls.filter(([id]) => id === 'w1').length;

    await userEvent.click(within(row('Studio Two')).getByRole('button', { name: 'Delete Studio Two' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(releasedTwo()).toBe(1);
    await userEvent.click(within(row('Studio Three')).getByRole('button', { name: 'Delete Studio Three' }));
    expect(await screen.findByText(/2 invoice or quotes/)).toBeInTheDocument();

    // The first, slow answer arrives now. It describes another business and must not replace what is shown.
    openGate();
    await waitFor(() => expect(releasedTwo()).toBe(2));
    expect(screen.getByText(/2 invoice or quotes/)).toBeInTheDocument();
    expect(screen.queryByText(/1 invoice or quote,/)).not.toBeInTheDocument();
  });

  it('lets go of the connection opened for counting when the page is left', async () => {
    const manager = await setup();
    const release = vi.spyOn(manager, 'release');
    await userEvent.click(within(row('Studio Two')).getByRole('button', { name: 'Delete Studio Two' }));
    await screen.findByText(/0 invoice or quotes/);
    cleanup();
    expect(release).toHaveBeenCalledWith('w1');
  });
});
