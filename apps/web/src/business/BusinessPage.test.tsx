import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type WorkspaceManager } from '@solokit/storage';
import { createBackup, createInvoiceStorage } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { WorkspacesProvider, useWorkspaces, type WorkspacesState } from '../workspace/WorkspaceProvider';
import { BusinessPage } from './BusinessPage';
import { makeManager } from './testWorkspaces';

let latest: WorkspacesState;

function Capture() {
  latest = useWorkspaces();
  return null;
}

function renderPage(manager: WorkspaceManager) {
  return render(
    <WorkspacesProvider manager={manager}>
      <Capture />
      <BusinessPage now={() => new Date('2026-10-16T10:00:00Z')} />
    </WorkspacesProvider>,
  );
}

afterEach(() => {
  window.location.hash = '';
  vi.restoreAllMocks();
});

async function seed(manager: WorkspaceManager, id: string, profile = makeSeller()) {
  const storage = createInvoiceStorage(await manager.openStore(id));
  await storage.profile.save(profile);
  return storage;
}

describe('BusinessPage', () => {
  it('asks a new business to set itself up, prefilled with its name, and renames the business to the name typed', async () => {
    const { manager } = makeManager();
    renderPage(manager);
    expect(await screen.findByRole('heading', { name: 'Set up My business' })).toBeInTheDocument();
    expect(screen.getByLabelText('Business or personal name')).toHaveValue('My business');
    await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
    await userEvent.clear(screen.getByLabelText('Business or personal name'));
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Terra Studio');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
    await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByText(/^Saved\./)).toBeInTheDocument();
    await waitFor(() => expect(latest.current?.name).toBe('Terra Studio'));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'This business' })).toBeInTheDocument();
  });

  it('shows the saved details, tags each section with the tools that use it, and leaves a deliberate business name alone', async () => {
    const { manager } = makeManager();
    await manager.list();
    await manager.rename('default', 'Front desk');
    await seed(manager, 'default', makeSeller({ name: 'Asha Rao Consulting' }));
    renderPage(manager);
    expect(await screen.findByLabelText('Business or personal name')).toHaveValue('Asha Rao Consulting');
    expect(screen.getByRole('group', { name: 'Payment details' })).not.toHaveTextContent('Contracts');
    expect(screen.getByRole('group', { name: 'Business details' })).toHaveTextContent('Contracts');
    await userEvent.clear(screen.getByLabelText('Business or personal name'));
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Asha Rao Advisory');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText(/^Saved\./);
    expect(latest.current?.name).toBe('Front desk');
    expect((await createInvoiceStorage(await manager.openStore('default')).profile.get())?.name).toBe('Asha Rao Advisory');
  });

  it('keeps the link to the brand theme when the form is saved again', async () => {
    const { manager } = makeManager();
    const storage = await seed(manager, 'default', makeSeller({ brand: { primary: '#7C2D12' }, brandSource: 'manual', brandTheme: { themeId: 't1', signature: 's' } }));
    renderPage(manager);
    await userEvent.type(await screen.findByLabelText('Phone'), '9999999999');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText(/^Saved\./);
    expect((await storage.profile.get())?.brandTheme).toEqual({ themeId: 't1', signature: 's' });
  });

  it('offers the brand theme under the brand colours, and makes it', async () => {
    const { manager } = makeManager();
    const storage = await seed(manager, 'default', makeSeller({ brand: { primary: '#7C2D12' }, brandSource: 'manual' }));
    renderPage(manager);
    await userEvent.click(await screen.findByRole('button', { name: 'Create a Brand theme' }));
    expect(await screen.findByText(/Created the theme "Asha Rao Consulting brand"/)).toBeInTheDocument();
    expect((await storage.themes.list()).map((theme) => theme.name)).toEqual(['Asha Rao Consulting brand']);
  });

  it('has the backup section for this business, naming it', async () => {
    const { manager } = makeManager();
    await seed(manager, 'default');
    renderPage(manager);
    const heading = await screen.findByRole('heading', { name: 'Backup & restore' });
    expect(heading).toBeInTheDocument();
    expect(screen.getByText(/A backup covers one business at a time/)).toHaveTextContent('My business');
  });

  it('restores a backup as a new business, the safer choice when the device already has data, and leaves this one alone', async () => {
    const { manager } = makeManager();
    const own = await seed(manager, 'default', makeSeller({ name: 'Asha Rao Consulting' }));
    await own.invoices.save(makeInvoice({ id: 'mine', number: '2026-27/0007' }));
    const other = createMemoryStore();
    const otherStorage = createInvoiceStorage(other);
    await otherStorage.profile.save(makeSeller({ name: 'Elsewhere Ltd' }));
    await otherStorage.invoices.save(makeInvoice({ id: 'theirs', number: '2026-27/0001' }));
    const { json } = await createBackup(other, new Date('2026-10-01T00:00:00Z'), { workspaceName: 'My business' });

    renderPage(manager);
    await screen.findByRole('heading', { name: 'Backup & restore' });
    await userEvent.upload(screen.getByLabelText('Backup file'), new File([json], 'b.json', { type: 'application/json' }));
    const summary = await screen.findByRole('region', { name: 'Restore this backup?' });
    expect(summary).toHaveTextContent('"My business" now holds 1 invoice');
    expect(summary).toHaveTextContent('Replacing "My business" deletes all of it. Restoring as a new business deletes nothing.');
    const buttons = within(summary).getAllByRole('button').map((button) => button.textContent);
    expect(buttons.slice(-3)).toEqual(['Restore as a new business', 'Yes, replace "My business"', 'Cancel']);

    await userEvent.click(within(summary).getByRole('button', { name: 'Restore as a new business' }));
    expect(await screen.findByText('Backup restored as a new business')).toBeInTheDocument();
    expect(latest.workspaces.map((workspace) => workspace.name)).toEqual(['My business', 'My business (restored)']);
    expect(latest.current?.name).toBe('My business');
    expect((await own.invoices.list()).map((invoice) => invoice.id)).toEqual(['mine']);
    const copy = createInvoiceStorage(await manager.openStore(latest.workspaces[1]!.id));
    expect((await copy.invoices.list()).map((invoice) => invoice.id)).toEqual(['theirs']);

    await userEvent.click(within(screen.getByRole('region', { name: 'Restore from a backup' })).getByRole('button', { name: 'Switch to My business (restored)' }));
    await waitFor(() => expect(latest.current?.name).toBe('My business (restored)'));
  });

  it('replaces the current business only when asked, naming it in the confirmation', async () => {
    const { manager } = makeManager();
    const own = await seed(manager, 'default');
    const other = createMemoryStore();
    await createInvoiceStorage(other).profile.save(makeSeller({ name: 'Elsewhere Ltd' }));
    const { json } = await createBackup(other, new Date('2026-10-01T00:00:00Z'));
    renderPage(manager);
    await screen.findByRole('heading', { name: 'Backup & restore' });
    await userEvent.upload(screen.getByLabelText('Backup file'), new File([json], 'b.json', { type: 'application/json' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, replace "My business"' }));
    await waitFor(async () => expect((await own.profile.get())?.name).toBe('Elsewhere Ltd'));
  });

  it('shows the add-a-business flow for #add, and cancelling returns to the page', async () => {
    const { manager } = makeManager();
    await seed(manager, 'default');
    window.location.hash = '#add';
    renderPage(manager);
    expect(await screen.findByRole('heading', { name: 'Add a business' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Backup & restore' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { name: 'Your businesses' })).toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });

  it('adds a business from the flow and shows its own, empty, setup', async () => {
    const { manager } = makeManager();
    await seed(manager, 'default');
    window.location.hash = '#add';
    renderPage(manager);
    await userEvent.type(await screen.findByLabelText(/Business name/), 'Studio Two');
    await userEvent.click(screen.getByRole('button', { name: 'Create business' }));
    expect(await screen.findByRole('heading', { name: 'Set up Studio Two' }, { timeout: 25_000 })).toBeInTheDocument();
    expect(screen.getByLabelText('Business or personal name')).toHaveValue('Studio Two');
    expect(latest.current?.name).toBe('Studio Two');
  });

  it('reacts to the hash changing while open', async () => {
    const { manager } = makeManager();
    await seed(manager, 'default');
    renderPage(manager);
    await screen.findByRole('heading', { name: 'This business' });
    act(() => {
      window.location.hash = '#add';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(await screen.findByRole('heading', { name: 'Add a business' })).toBeInTheDocument();
  });
});
