import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createBackup, createInvoiceStorage } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { WorkspacesProvider, useWorkspaces, type WorkspacesState } from '../workspace/WorkspaceProvider';
import { AddBusiness } from './AddBusiness';
import { makeManager } from './testWorkspaces';

let latest: WorkspacesState;

function Capture() {
  latest = useWorkspaces();
  return null;
}

async function setup() {
  const { manager } = makeManager();
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(
    <WorkspacesProvider manager={manager}>
      <Capture />
      <AddBusiness onCreated={onCreated} onCancel={onCancel} />
    </WorkspacesProvider>,
  );
  await screen.findByRole('heading', { name: 'Add a business' });
  await waitFor(() => expect(latest.ready).toBe(true));
  return { manager, onCreated, onCancel };
}

async function backupFile(): Promise<File> {
  const store = createMemoryStore();
  const storage = createInvoiceStorage(store);
  await storage.profile.save(makeSeller({ name: 'Backed Up Co' }));
  await storage.invoices.save(makeInvoice());
  const { json } = await createBackup(store, new Date('2026-10-01T00:00:00Z'), { workspaceName: 'Old Name' });
  return new File([json], 'backup.json', { type: 'application/json' });
}

describe('AddBusiness', () => {
  it('moves focus to its heading and asks for a name first', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Add a business' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Create business' }));
    expect(await screen.findByText('Enter a name for the business')).toBeInTheDocument();
    expect(latest.workspaces).toHaveLength(1);
  });

  it('creates the business, makes it current and hands over', async () => {
    const { onCreated } = await setup();
    await userEvent.type(screen.getByLabelText(/Business name/), 'Studio Two');
    await userEvent.click(screen.getByRole('button', { name: 'Create business' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(onCreated.mock.calls[0]?.[0]).toMatchObject({ name: 'Studio Two' });
    expect(latest.current?.name).toBe('Studio Two');
    expect(latest.workspaces.map((workspace) => workspace.name)).toEqual(['My business', 'Studio Two']);
  });

  it('Cancel leaves without creating anything', async () => {
    const { onCancel } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(latest.workspaces).toHaveLength(1);
  });

  it('restores a backup into a new business named from the file, leaving the current one untouched', async () => {
    const { manager, onCreated } = await setup();
    await userEvent.upload(screen.getByLabelText('Backup file'), await backupFile());
    expect(await screen.findByText(/1 invoice, 0 agreements, 0 clients and a business profile/)).toBeInTheDocument();
    expect(screen.getByLabelText('Name of the new business')).toHaveValue('Old Name');
    await userEvent.clear(screen.getByLabelText('Name of the new business'));
    await userEvent.type(screen.getByLabelText('Name of the new business'), 'Restored Co');
    await userEvent.click(screen.getByRole('button', { name: 'Restore as a new business' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce());
    expect(latest.current?.name).toBe('Restored Co');
    const restored = createInvoiceStorage(await manager.openStore(latest.current!.id));
    expect((await restored.invoices.list()).length).toBe(1);
    const first = createInvoiceStorage(await manager.openStore('default'));
    expect(await first.invoices.list()).toEqual([]);
  });

  it('refuses a file that is not a backup and creates nothing', async () => {
    await setup();
    await userEvent.upload(screen.getByLabelText('Backup file'), new File(['{"hello":1}'], 'x.json', { type: 'application/json' }));
    expect(await screen.findByText('This file cannot be restored')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore as a new business' })).not.toBeInTheDocument();
    expect(latest.workspaces).toHaveLength(1);
  });
});
