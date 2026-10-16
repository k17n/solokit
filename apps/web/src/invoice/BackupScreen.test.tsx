import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type DataStore } from '@solokit/storage';
import { createBackup, createInvoiceStorage } from '@solokit/tool-invoice';
import { makeClient, makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { BackupScreen } from './BackupScreen';
import * as downloads from './downloads';

afterEach(() => vi.restoreAllMocks());

const NOW = new Date('2026-10-16T08:00:00.000Z');

async function seeded(store: DataStore = createMemoryStore()) {
  const storage = createInvoiceStorage(store, { now: () => NOW });
  await storage.profile.save(makeSeller({ name: 'Original Co' }));
  await storage.clients.save(makeClient());
  await storage.invoices.save(makeInvoice({ id: 'one' }));
  return { store, storage };
}

async function setup(store?: DataStore) {
  const base = await seeded(store);
  const onRestored = vi.fn();
  render(<BackupScreen store={base.store} now={() => NOW} onRestored={onRestored} />);
  await screen.findByRole('heading', { name: 'Backup & restore' });
  return { ...base, onRestored };
}

function textOf(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

function fileOf(text: string, name = 'backup.json') {
  return new File([text], name, { type: 'application/json' });
}

describe('BackupScreen: download', () => {
  it('says plainly that the file is not encrypted and holds bank and client details', async () => {
    await setup();
    const warning = screen.getByText(/not encrypted/i);
    expect(warning.closest('[role]')).toHaveTextContent(/bank/i);
    expect(warning.closest('[role]')).toHaveTextContent(/client/i);
  });

  it('shows that nothing has been backed up yet', async () => {
    await setup();
    expect(screen.getByText(/never backed up/i)).toBeInTheDocument();
  });

  it('creates the backup only when the download starts, then records and shows the time', async () => {
    const download = vi.spyOn(downloads, 'downloadBlob').mockImplementation(() => {});
    const { storage } = await setup();
    expect((await storage.settings.get()).lastBackupAt).toBeUndefined();
    expect(download).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Download backup' }));
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    const [blob, filename] = download.mock.calls[0]!;
    expect(filename).toBe('solokit-backup-2026-10-16.json');
    expect(JSON.parse(await textOf(blob)).collections.invoices).toHaveLength(1);
    expect((await storage.settings.get()).lastBackupAt).toBe(NOW.toISOString());
    expect(await screen.findByText(/Last backup:/)).toBeInTheDocument();
  });

  it('reports a failure to build the file', async () => {
    vi.spyOn(downloads, 'downloadBlob').mockImplementation(() => {
      throw new Error('no');
    });
    await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByText(/could not be created/i)).toBeInTheDocument();
  });
});

describe('BackupScreen: restore', () => {
  async function backupOf(name: string) {
    const other = createMemoryStore();
    const storage = createInvoiceStorage(other, { now: () => NOW });
    await storage.profile.save(makeSeller({ name }));
    await storage.invoices.save(makeInvoice({ id: 'a' }));
    await storage.invoices.save(makeInvoice({ id: 'b', number: '2026-27/0002' }));
    return (await createBackup(other, NOW)).json;
  }

  it('summarises what will be replaced and changes nothing until confirmed', async () => {
    const { storage } = await setup();
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(await backupOf('Restored Co')));
    const summary = await screen.findByRole('region', { name: 'Restore this backup?' });
    expect(summary).toHaveTextContent('Restored Co');
    expect(summary).toHaveTextContent(/2 invoices/);
    expect(summary).toHaveTextContent(/1 invoice/);
    expect((await storage.profile.get())?.name).toBe('Original Co');
  });

  it('replaces everything after explicit confirmation', async () => {
    const { storage, onRestored } = await setup();
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(await backupOf('Restored Co')));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, replace my data' }));
    await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
    expect((await storage.profile.get())?.name).toBe('Restored Co');
    expect((await storage.invoices.list()).map((invoice) => invoice.id).sort()).toEqual(['a', 'b']);
    expect(await screen.findByText(/restored/i)).toBeInTheDocument();
  });

  it('can be cancelled', async () => {
    const { storage, onRestored } = await setup();
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(await backupOf('Restored Co')));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Yes, replace my data' })).not.toBeInTheDocument();
    expect(onRestored).not.toHaveBeenCalled();
    expect((await storage.profile.get())?.name).toBe('Original Co');
  });

  it('rejects a file that is not a backup, keeping the data', async () => {
    const { storage } = await setup();
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf('hello'));
    expect(await screen.findByText(/not valid JSON/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yes, replace my data' })).not.toBeInTheDocument();
    expect((await storage.invoices.list()).length).toBe(1);
  });

  it('warns when the backup has no business profile', async () => {
    await setup();
    const empty = createMemoryStore();
    const json = (await createBackup(empty, NOW)).json;
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(json));
    expect(await screen.findByText(/asked to set it up again/i)).toBeInTheDocument();
  });
});
