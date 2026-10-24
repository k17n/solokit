import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type DataStore, type WorkspaceManager } from '@solokit/storage';
import { createBackup, createInvoiceStorage } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { makeManager } from '../business/testWorkspaces';
import { StoreProvider } from '../store/StoreProvider';
import { WorkspaceStore, WorkspacesProvider, useWorkspaces, type WorkspacesState } from '../workspace/WorkspaceProvider';
import { navigate } from './navigate';
import { SetupPage } from './SetupPage';

vi.mock('./navigate', () => ({ navigate: vi.fn() }));

let latest: WorkspacesState;

function Capture() {
  latest = useWorkspaces();
  return null;
}

/** Opens the setup page at this address. */
function at(url: string) {
  window.history.replaceState(null, '', url);
}

function renderSetup(store: DataStore = createMemoryStore(), { persistent = true } = {}) {
  render(
    <StoreProvider factory={() => store} persistent={persistent}>
      <SetupPage />
    </StoreProvider>,
  );
  return store;
}

function renderWithBusinesses(manager: WorkspaceManager) {
  render(
    <WorkspacesProvider manager={manager}>
      <Capture />
      <WorkspaceStore>
        <SetupPage />
      </WorkspaceStore>
    </WorkspacesProvider>,
  );
}

const heading = () => screen.getByRole('heading', { level: 2 });

async function next(step: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(heading()).toHaveTextContent(step));
}

/** Fills the two required steps for an unregistered seller and walks to the last step. */
async function walkThrough(name = 'Ravi Kumar') {
  await screen.findByRole('heading', { name: 'Tax registration' });
  await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
  await next('Business details');
  const field = screen.getByLabelText('Business or personal name');
  await userEvent.clear(field);
  await userEvent.type(field, name);
  await userEvent.type(screen.getByLabelText('Address line 1'), '4 Park Street');
  await userEvent.type(screen.getByLabelText('City'), 'Kolkata');
  await userEvent.type(screen.getByLabelText(/^Email/), 'ravi@example.com');
  await next('Logo and brand colours');
  await next('Getting paid');
  await next('Invoice defaults');
}

afterEach(() => {
  at('/');
  vi.mocked(navigate).mockClear();
  vi.restoreAllMocks();
});

describe('SetupPage: the first time', () => {
  it('names the tool it came from, sets the business up step by step, and goes back to the tool', async () => {
    at('/app/setup/?next=%2Fapp%2Finvoice%2F');
    const store = renderSetup();
    expect(screen.getByText('Opening your business…')).toBeInTheDocument();
    expect(await screen.findByText(/Before you open the/)).toHaveTextContent('Before you open the Invoice generator, tell SoloKit about your business.');
    await walkThrough();
    await userEvent.click(screen.getByRole('button', { name: 'Finish and open Invoice generator' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/invoice/'));
    const storage = createInvoiceStorage(store);
    expect(await storage.profile.get()).toMatchObject({ name: 'Ravi Kumar', gstStatus: 'unregistered', email: 'ravi@example.com' });
    expect((await storage.settings.get()).onboarded).toBe(true);
  });

  it('goes to the app home, welcoming the person, when it was opened on its own', async () => {
    at('/app/setup/');
    renderSetup();
    await walkThrough();
    await userEvent.click(screen.getByRole('button', { name: 'Finish setup' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/?welcome=1'));
  });

  it('never sends people to another site after setup', async () => {
    at('/app/setup/?next=https%3A%2F%2Fevil.example%2F');
    renderSetup();
    await walkThrough();
    await userEvent.click(screen.getByRole('button', { name: 'Finish setup' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/?welcome=1'));
  });

  it('starts the name with the business name, and renames the business to the name typed', async () => {
    const { manager } = makeManager();
    await manager.list();
    const created = await manager.create('Studio Two', { nameInSync: true });
    await manager.setCurrent(created.id);
    at('/app/setup/?next=%2Fapp%2Fbusiness%2F');
    renderWithBusinesses(manager);
    await screen.findByRole('heading', { name: 'Tax registration' });
    await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
    await next('Business details');
    expect(screen.getByLabelText('Business or personal name')).toHaveValue('Studio Two');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    await walkThrough('Studio Two Design');
    await userEvent.click(screen.getByRole('button', { name: 'Finish and open Your business' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/business/'));
    await waitFor(() => expect(latest.current?.name).toBe('Studio Two Design'));
  });

  it('opens at the first step with something missing when only part of the details is there', async () => {
    const store = createMemoryStore();
    await createInvoiceStorage(store).profile.save(makeSeller({ email: undefined }));
    at('/app/setup/?next=%2Fapp%2Fcontract%2F');
    renderSetup(store);
    expect(await screen.findByRole('heading', { name: 'Business details' })).toBeInTheDocument();
    expect(screen.getByLabelText('Business or personal name')).toHaveValue('Asha Rao Consulting');
    expect(screen.queryByRole('button', { name: /restore a backup/i })).not.toBeInTheDocument();
  });

  it('warns when the browser is not saving data', async () => {
    at('/app/setup/');
    renderSetup(createMemoryStore(), { persistent: false });
    expect(await screen.findByText('Your browser is not saving data')).toBeInTheDocument();
  });

  it('still finishes when only the onboarded flag cannot be saved', async () => {
    const inner = createMemoryStore();
    const store: DataStore = { ...inner, put: (collection, record) => (collection === 'settings' ? Promise.reject(new Error('write failed')) : inner.put(collection, record)) };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    at('/app/setup/?next=%2Fapp%2Finvoice%2F');
    renderSetup(store);
    await walkThrough();
    await userEvent.click(screen.getByRole('button', { name: 'Finish and open Invoice generator' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/invoice/'));
    expect(error).toHaveBeenCalled();
    expect((await createInvoiceStorage(inner).profile.get())?.name).toBe('Ravi Kumar');
  });

  it('offers to try again when the saved details cannot be read', async () => {
    const inner = createMemoryStore();
    let failing = true;
    const store: DataStore = { ...inner, get: (collection, id) => (failing ? Promise.reject(new Error('read failed')) : inner.get(collection, id)) };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    at('/app/setup/');
    renderSetup(store);
    expect(await screen.findByText('Your saved details could not be opened')).toBeInTheDocument();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Tax registration' })).toBeInTheDocument();
  });
});

describe('SetupPage: restoring on a new device', () => {
  async function backupJson(withProfile: boolean) {
    const other = createMemoryStore();
    const source = createInvoiceStorage(other);
    if (withProfile) await source.profile.save(makeSeller({ name: 'Moved Co' }));
    await source.invoices.save(makeInvoice({ id: 'moved', number: '2026-27/0042' }));
    return (await createBackup(other)).json;
  }

  async function restore(json: string) {
    await userEvent.click(await screen.findByRole('button', { name: /restore a backup/i }));
    expect(screen.queryByRole('button', { name: 'Download backup' })).not.toBeInTheDocument();
    await userEvent.upload(await screen.findByLabelText('Backup file'), new File([json], 'b.json', { type: 'application/json' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, replace my data' }));
  }

  it('restores a backup instead of setting up, and goes on to the tool', async () => {
    at('/app/setup/?next=%2Fapp%2Finvoice%2F');
    const store = renderSetup();
    await restore(await backupJson(true));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/invoice/'));
    expect((await createInvoiceStorage(store).profile.get())?.name).toBe('Moved Co');
  });

  it('asks for the rest when the backup has no business details', async () => {
    at('/app/setup/?next=%2Fapp%2Finvoice%2F');
    renderSetup();
    await restore(await backupJson(false));
    expect(await screen.findByText('Backup restored')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tax registration' })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('goes back to setup', async () => {
    at('/app/setup/');
    renderSetup();
    await userEvent.click(await screen.findByRole('button', { name: /restore a backup/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to setup' }));
    expect(await screen.findByRole('heading', { name: 'Tax registration' })).toBeInTheDocument();
  });
});

describe('SetupPage: changing the details later', () => {
  async function seeded(profile = makeSeller()) {
    const store = createMemoryStore();
    await createInvoiceStorage(store).profile.save(profile);
    return store;
  }

  it('opens the step asked for, saves, and goes back to the tool it came from', async () => {
    const store = await seeded();
    at('/app/setup/?next=%2Fapp%2Fcontract%2F&step=payments');
    renderSetup(store);
    expect(await screen.findByRole('heading', { name: 'Getting paid' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Contract and NDA generator without saving' })).toHaveAttribute('href', '/app/contract/');
    const upi = screen.getByLabelText('UPI ID');
    await userEvent.clear(upi);
    await userEvent.type(upi, 'asha@okicici');
    await userEvent.click(screen.getByRole('button', { name: 'Save and return to Contract and NDA generator' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/contract/'));
    expect((await createInvoiceStorage(store).profile.get())?.upiId).toBe('asha@okicici');
  });

  it('goes back to Your business when opened on its own', async () => {
    at('/app/setup/');
    renderSetup(await seeded());
    await userEvent.click(await screen.findByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/business/'));
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/app/business/');
  });

  it('offers the brand theme under the brand colours, and keeps the link to it when saving', async () => {
    const store = await seeded(makeSeller({ brand: { primary: '#7C2D12' }, brandSource: 'manual' }));
    at('/app/setup/?step=brand');
    renderSetup(store);
    await userEvent.click(await screen.findByRole('button', { name: 'Create a Brand theme' }));
    expect(await screen.findByText(/Created the theme "Asha Rao Consulting brand"/)).toBeInTheDocument();
    const storage = createInvoiceStorage(store);
    expect((await storage.themes.list()).map((theme) => theme.name)).toEqual(['Asha Rao Consulting brand']);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect((await storage.profile.get())?.brandTheme).toBeDefined();
  });

  it('leaves a business name set on purpose alone', async () => {
    const { manager } = makeManager();
    await manager.list();
    await manager.rename('default', 'Front desk');
    await createInvoiceStorage(await manager.openStore('default')).profile.save(makeSeller());
    at('/app/setup/?step=details');
    renderWithBusinesses(manager);
    const name = await screen.findByLabelText('Business or personal name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Asha Rao Advisory');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(latest.current?.name).toBe('Front desk');
    expect((await createInvoiceStorage(await manager.openStore('default')).profile.get())?.name).toBe('Asha Rao Advisory');
  });
});
