import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type WorkspaceManager } from '@solokit/storage';
import { createBackup, createInvoiceStorage } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { navigate } from '../setup/navigate';
import { WorkspacesProvider, useWorkspaces, type WorkspacesState } from '../workspace/WorkspaceProvider';
import { BusinessPage } from './BusinessPage';
import { makeManager } from './testWorkspaces';

vi.mock('../setup/navigate', () => ({ navigate: vi.fn() }));

const SETUP = '/setup/?next=%2Fbusiness%2F';

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
  vi.mocked(navigate).mockClear();
  vi.restoreAllMocks();
});

async function seed(manager: WorkspaceManager, id: string, profile = makeSeller()) {
  const storage = createInvoiceStorage(await manager.openStore(id));
  await storage.profile.save(profile);
  return storage;
}

describe('BusinessPage', () => {
  it('sends a new business to the setup page, which comes back here', async () => {
    const { manager } = makeManager();
    renderPage(manager);
    expect(await screen.findByRole('heading', { name: 'Set up My business' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set up this business' })).toHaveAttribute('href', SETUP);
    expect(screen.queryByLabelText('Business or personal name')).not.toBeInTheDocument();
  });

  it('offers to finish setup when a detail some tool needs is missing', async () => {
    const { manager } = makeManager();
    await seed(manager, 'default', makeSeller({ email: undefined }));
    renderPage(manager);
    expect(await screen.findByRole('link', { name: 'Finish setup' })).toHaveAttribute('href', SETUP);
  });

  it('summarises the saved details, with a link to change each part on the setup page', async () => {
    const { manager } = makeManager();
    await seed(manager, 'default', makeSeller({ name: 'Asha Rao Consulting', brand: { primary: '#7C2D12' }, brandSource: 'manual' }));
    renderPage(manager);
    expect(await screen.findByRole('heading', { name: 'This business' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit details' })).toHaveAttribute('href', SETUP);
    const summary = screen.getByText('Asha Rao Consulting').closest('dl')!;
    expect(summary).toHaveTextContent('Regular GST registration · GSTIN 27AAPFU0939F1ZV');
    expect(summary).toHaveTextContent('Asha Rao Consulting');
    expect(summary).toHaveTextContent('12 Linking Road, Mumbai, 400050, Maharashtra');
    expect(summary).toHaveTextContent('HDFC Bank account ending 9012, UPI asha@okhdfc');
    // Only the end of the account number, in case the page is on a shared screen.
    expect(summary).not.toHaveTextContent('123456789012');
    expect(screen.getByRole('link', { name: 'Change getting paid' })).toHaveAttribute('href', `${SETUP}&step=payments`);
    expect(screen.getByRole('link', { name: 'Change logo and brand colours' })).toHaveAttribute('href', `${SETUP}&step=brand`);
    expect(screen.queryByLabelText('Business or personal name')).not.toBeInTheDocument();
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

  it('adds a business from the flow and sends it to its own setup', async () => {
    const { manager } = makeManager();
    await seed(manager, 'default');
    window.location.hash = '#add';
    renderPage(manager);
    await userEvent.type(await screen.findByLabelText(/Business name/), 'Studio Two');
    await userEvent.click(screen.getByRole('button', { name: 'Create business' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(SETUP));
    expect(latest.current?.name).toBe('Studio Two');
    expect(latest.current?.nameInSync).toBe(true);
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
