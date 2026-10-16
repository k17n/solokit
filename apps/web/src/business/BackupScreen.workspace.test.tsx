import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, createWorkspaceManager, type WorkspaceManager } from '@solokit/storage';
import { createBackup, createInvoiceStorage } from '@solokit/tool-invoice';
import { makeSeller } from '@solokit/tool-invoice/testing';
import * as downloads from '../invoice/downloads';
import { useStore } from '../store/StoreProvider';
import { WorkspacesProvider, WorkspaceStore, useWorkspaces, type WorkspacesState } from '../workspace/WorkspaceProvider';
import { BackupScreen } from './BackupScreen';
import { makeManager } from './testWorkspaces';

afterEach(() => vi.restoreAllMocks());

const NOW = new Date('2026-10-16T08:00:00.000Z');
let latest: WorkspacesState;

function Screen() {
  const { store, ready } = useStore();
  latest = useWorkspaces();
  return ready && store ? <BackupScreen store={store} onRestored={() => {}} now={() => NOW} /> : <p>loading</p>;
}

function renderScreen(manager: WorkspaceManager) {
  return render(
    <WorkspacesProvider manager={manager}>
      <WorkspaceStore>
        <Screen />
      </WorkspaceStore>
    </WorkspacesProvider>,
  );
}

async function backupFile(name: string) {
  const store = createMemoryStore();
  await createInvoiceStorage(store).profile.save(makeSeller({ name }));
  const { json } = await createBackup(store, NOW);
  return new File([json], 'b.json', { type: 'application/json' });
}

async function seedProfile(manager: WorkspaceManager, name: string) {
  await createInvoiceStorage(await manager.openStore('default')).profile.save(makeSeller({ name }));
}

describe('BackupScreen names the business whose data is at stake', () => {
  it('says "the data in <business>" for the safety copy and the replace, and again in the success message', async () => {
    const download = vi.spyOn(downloads, 'downloadBlob').mockImplementation(() => {});
    const { manager } = makeManager();
    await manager.list();
    await manager.rename('default', 'Front desk');
    await seedProfile(manager, 'Asha Rao Consulting');
    renderScreen(manager);
    await userEvent.upload(await screen.findByLabelText('Backup file'), await backupFile('Elsewhere Ltd'));
    const summary = await screen.findByRole('region', { name: 'Restore this backup?' });

    await userEvent.click(within(summary).getByRole('button', { name: 'Download a backup of the data in "Front desk" first' }));
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    expect(await within(summary).findByText('A backup of the data in "Front desk" was downloaded.')).toBeInTheDocument();

    await userEvent.click(within(summary).getByRole('button', { name: 'Yes, replace "Front desk"' }));
    expect(await screen.findByText('Backup restored. Everything in "Front desk" now matches the file.')).toBeInTheDocument();
  });
});

describe('BackupScreen keeps the business name in step with a restored profile', () => {
  it('renames a business whose name followed its profile', async () => {
    const { manager } = makeManager();
    await manager.list();
    await manager.rename('default', 'Old Co', { keepInSync: true });
    await seedProfile(manager, 'Old Co');
    renderScreen(manager);
    await userEvent.upload(await screen.findByLabelText('Backup file'), await backupFile('Restored Co'));
    await userEvent.click(await screen.findByRole('button', { name: /^Yes, replace/ }));
    await waitFor(() => expect(latest.current?.name).toBe('Restored Co'));
    expect(await screen.findByText('Backup restored. Everything in "Restored Co" now matches the file.')).toBeInTheDocument();
    // Still following the profile afterwards.
    expect(latest.current?.nameInSync).toBe(true);
  });

  it('renames a business that still has the placeholder name', async () => {
    const { manager } = makeManager();
    renderScreen(manager);
    await userEvent.upload(await screen.findByLabelText('Backup file'), await backupFile('Restored Co'));
    await userEvent.click(await screen.findByRole('button', { name: /^Yes, replace/ }));
    await waitFor(() => expect(latest.current?.name).toBe('Restored Co'));
  });

  it('leaves a name chosen on purpose alone', async () => {
    const { manager } = makeManager();
    await manager.list();
    await manager.rename('default', 'Front desk');
    await seedProfile(manager, 'Old Co');
    renderScreen(manager);
    await userEvent.upload(await screen.findByLabelText('Backup file'), await backupFile('Restored Co'));
    await userEvent.click(await screen.findByRole('button', { name: /^Yes, replace/ }));
    expect(await screen.findByText('Backup restored. Everything in "Front desk" now matches the file.')).toBeInTheDocument();
    expect(latest.current?.name).toBe('Front desk');
  });
});

describe('BackupScreen when the list of businesses is only kept in memory', () => {
  it('warns on the restore-as-new step that the new business will vanish on reload', async () => {
    const manager = createWorkspaceManager({ factory: null, storage: null, broadcast: false });
    await createInvoiceStorage(await manager.openStore((await manager.list())[0]!.id)).profile.save(makeSeller({ name: 'Asha' }));
    renderScreen(manager);
    await userEvent.upload(await screen.findByLabelText('Backup file'), await backupFile('Elsewhere Ltd'));
    const summary = await screen.findByRole('region', { name: 'Restore this backup?' });
    expect(within(summary).getByText('A new business would not be kept')).toBeInTheDocument();
    expect(summary).toHaveTextContent(/will vanish when you reload or close this page/);
    await userEvent.click(within(summary).getByRole('button', { name: 'Restore as a new business' }));
    expect(await screen.findByText(/will be gone when you reload or close this page/)).toBeInTheDocument();
  });

  it('shows no such warning when the list is saved on the device', async () => {
    const { manager } = makeManager();
    await seedProfile(manager, 'Asha');
    renderScreen(manager);
    await userEvent.upload(await screen.findByLabelText('Backup file'), await backupFile('Elsewhere Ltd'));
    await screen.findByRole('region', { name: 'Restore this backup?' });
    expect(screen.queryByText('A new business would not be kept')).not.toBeInTheDocument();
  });
});
