import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type DataStore } from '@solokit/storage';
import { createContractStorage } from '@solokit/tool-contract';
import { makeContract } from '@solokit/tool-contract/testing';
import { createBackup, createInvoiceStorage } from '@solokit/tool-invoice';
import { makeClient, makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { BackupScreen } from './BackupScreen';
import * as downloads from '../invoice/downloads';

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

describe('BackupScreen: failures leave the backup time alone', () => {
  const PREVIOUS = '2026-09-01T00:00:00.000Z';

  it('keeps the previous time when the download fails', async () => {
    vi.spyOn(downloads, 'downloadBlob').mockImplementation(() => {
      throw new Error('no');
    });
    const { storage } = await setup();
    await storage.settings.update({ lastBackupAt: PREVIOUS });
    await userEvent.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(await screen.findByText(/could not be created/i)).toBeInTheDocument();
    expect((await storage.settings.get()).lastBackupAt).toBe(PREVIOUS);
  });

  it('keeps the previous time when the export fails', async () => {
    const download = vi.spyOn(downloads, 'downloadBlob').mockImplementation(() => {});
    const inner = createMemoryStore();
    const failing: DataStore = { ...inner, exportAll: () => Promise.reject(new Error('no')) };
    const storage = createInvoiceStorage(inner, { now: () => NOW });
    await storage.settings.update({ lastBackupAt: PREVIOUS });
    render(<BackupScreen store={failing} now={() => NOW} onRestored={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Download backup' }));
    expect(await screen.findByText(/could not be created/i)).toBeInTheDocument();
    expect(download).not.toHaveBeenCalled();
    expect((await storage.settings.get()).lastBackupAt).toBe(PREVIOUS);
  });

  it('leaves the time unset when a first backup fails', async () => {
    vi.spyOn(downloads, 'downloadBlob').mockImplementation(() => {
      throw new Error('no');
    });
    const { storage } = await setup();
    await userEvent.click(screen.getByRole('button', { name: 'Download backup' }));
    await screen.findByText(/could not be created/i);
    expect((await storage.settings.get()).lastBackupAt).toBeUndefined();
  });
});

describe('BackupScreen: restoring an older backup', () => {
  const EARLIER = new Date('2026-10-01T00:00:00.000Z');

  async function olderFile() {
    const other = createMemoryStore();
    const storage = createInvoiceStorage(other, { now: () => EARLIER });
    await storage.profile.save(makeSeller({ name: 'Older Co' }));
    await storage.invoices.save(makeInvoice({ id: 'a', number: '2026-27/0001' }));
    return (await createBackup(other, EARLIER)).json;
  }

  async function deviceWithMore() {
    const base = await setup();
    await base.storage.invoices.save(makeInvoice({ id: 'b', number: '2026-27/0002' }));
    await base.storage.invoices.save(makeInvoice({ id: 'c', number: '2026-27/0003', status: 'cancelled' }));
    return base;
  }

  it('names the invoice numbers that would be lost and says they could be reused', async () => {
    await deviceWithMore();
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(await olderFile()));
    const summary = await screen.findByRole('region', { name: 'Restore this backup?' });
    const warning = within(summary).getByRole('alert');
    expect(warning).toHaveTextContent('2026-27/0002');
    expect(warning).toHaveTextContent('2026-27/0003');
    expect(warning).toHaveTextContent(/lost/i);
    expect(warning).toHaveTextContent(/reuse/i);
    expect(warning).toHaveTextContent(/before the latest changes/i);
  });

  it('shows no loss warning when the file holds everything on the device', async () => {
    await setup();
    const same = createMemoryStore();
    const storage = createInvoiceStorage(same, { now: () => NOW });
    await storage.invoices.save(makeInvoice({ id: 'one' }));
    const snapshot = JSON.parse((await createBackup(same, NOW)).json);
    snapshot.exportedAt = '2026-10-17T00:00:00.000Z';
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(JSON.stringify(snapshot)));
    const summary = await screen.findByRole('region', { name: 'Restore this backup?' });
    expect(within(summary).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('counts agreements in the file and on the device, and keeps them in a backup', async () => {
    const device = createMemoryStore();
    await createContractStorage(device, { now: () => NOW }).save(makeContract('nda-mutual', { id: 'nda-1' }));
    const { store } = await setup(device);
    const source = createMemoryStore();
    const contracts = createContractStorage(source, { now: () => NOW });
    await contracts.save(makeContract('services', { id: 's1' }));
    await contracts.save(makeContract('nda-one-way', { id: 's2' }));
    const file = (await createBackup(source, NOW)).json;
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(file));
    const summary = await screen.findByRole('region', { name: 'Restore this backup?' });
    expect(within(summary).getByText(/The backup holds 0 invoices, 2 agreements/)).toBeInTheDocument();
    expect(within(summary).getByText(/This device now holds 1 invoice, 1 agreement/)).toBeInTheDocument();
    expect(JSON.parse((await createBackup(store, NOW)).json).collections.contracts).toHaveLength(1);
  });

  it('warns, naming final agreements and drafts, when the device has agreements the file lacks', async () => {
    const device = createMemoryStore();
    const contracts = createContractStorage(device, { now: () => NOW });
    await contracts.save(makeContract('services', { id: 'sv', title: 'Website for Acme' }));
    await contracts.save(makeContract('nda-mutual', { id: 'nd', title: 'NDA with Zed' }));
    await contracts.finalise('nd');
    await setup(device);
    // The file has no agreements and is newer than every change on the device, so only the missing agreements are at stake.
    const snapshot = JSON.parse(await olderFile());
    snapshot.exportedAt = '2026-10-20T00:00:00.000Z';
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(JSON.stringify(snapshot)));
    const summary = await screen.findByRole('region', { name: 'Restore this backup?' });
    const warning = within(summary).getByRole('alert');
    expect(warning).toHaveTextContent('1 final agreement on this device would be lost');
    expect(warning.querySelector('strong')).toHaveTextContent('"NDA with Zed"');
    expect(warning).toHaveTextContent(/may already be signed/);
    expect(warning).toHaveTextContent('1 draft agreement that is not in the backup would also be deleted: "Website for Acme"');
    expect(warning).not.toHaveTextContent(/before the latest changes/);
  });

  it('warns about a draft agreement alone, and about a file made before the latest change to an agreement', async () => {
    const device = createMemoryStore();
    await createContractStorage(device, { now: () => new Date('2026-10-15T00:00:00.000Z') }).save(makeContract('services', { id: 'sv', title: 'Website for Acme' }));
    await setup(device);
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(await olderFile()));
    const warning = within(await screen.findByRole('region', { name: 'Restore this backup?' })).getByRole('alert');
    expect(warning).toHaveTextContent(/Website for Acme/);
    expect(warning).toHaveTextContent(/before the latest changes/);
  });

  it('does not warn about agreements that the file also holds', async () => {
    const device = createMemoryStore();
    await createContractStorage(device, { now: () => EARLIER }).save(makeContract('services', { id: 'sv', title: 'Website for Acme' }));
    await setup(device);
    const snapshot = JSON.parse((await createBackup(device, NOW)).json);
    snapshot.exportedAt = '2026-10-20T00:00:00.000Z';
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(JSON.stringify(snapshot)));
    const summary = await screen.findByRole('region', { name: 'Restore this backup?' });
    expect(within(summary).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('can download a backup of the current data from the confirm step', async () => {
    const download = vi.spyOn(downloads, 'downloadBlob').mockImplementation(() => {});
    const { storage } = await deviceWithMore();
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(await olderFile()));
    await userEvent.click(await screen.findByRole('button', { name: 'Download a backup of the data on this device first' }));
    await waitFor(() => expect(download).toHaveBeenCalledOnce());
    const ids = (JSON.parse(await textOf(download.mock.calls[0]![0])).collections.invoices as { id: string }[]).map((invoice) => invoice.id).sort();
    expect(ids).toEqual(['b', 'c', 'one']);
    expect((await storage.settings.get()).lastBackupAt).toBe(NOW.toISOString());
    // The restore is still waiting for confirmation, and nothing was replaced.
    expect(screen.getByRole('button', { name: 'Yes, replace my data' })).toBeInTheDocument();
    expect((await storage.profile.get())?.name).toBe('Original Co');
  });

  it('does not record a backup when the safety download fails', async () => {
    vi.spyOn(downloads, 'downloadBlob').mockImplementation(() => {
      throw new Error('no');
    });
    const { storage } = await deviceWithMore();
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(await olderFile()));
    await userEvent.click(await screen.findByRole('button', { name: 'Download a backup of the data on this device first' }));
    expect(await screen.findByText(/backup of the data on this device could not be created/i)).toBeInTheDocument();
    expect((await storage.settings.get()).lastBackupAt).toBeUndefined();
  });
});

describe('BackupScreen: file checks and the result of a restore', () => {
  it('refuses a file over the size limit without reading it', async () => {
    await setup();
    const big = fileOf('{}');
    Object.defineProperty(big, 'size', { value: 51 * 1024 * 1024 });
    await userEvent.upload(screen.getByLabelText('Backup file'), big);
    expect(await screen.findByText(/too large/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Yes, replace my data' })).not.toBeInTheDocument();
  });

  it('says a newer backup needs a newer app', async () => {
    await setup();
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf(JSON.stringify({ version: 2, exportedAt: 'x', collections: {} })));
    expect(await screen.findByText(/newer version of SoloKit/i)).toBeInTheDocument();
    expect(screen.getByText(/update the app/i)).toBeInTheDocument();
  });

  it('moves focus to the success message after a restore', async () => {
    await setup();
    const other = createMemoryStore();
    await createInvoiceStorage(other, { now: () => NOW }).profile.save(makeSeller({ name: 'Restored Co' }));
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf((await createBackup(other, NOW)).json));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, replace my data' }));
    const status = await screen.findByText(/Backup restored/);
    await waitFor(() => expect(document.activeElement).toContainElement(status));
    expect(status.closest('[role="status"]')).not.toBeNull();
  });

  it('tells the user to complete setup when the restored backup has no profile', async () => {
    await setup();
    const empty = createMemoryStore();
    await userEvent.upload(screen.getByLabelText('Backup file'), fileOf((await createBackup(empty, NOW)).json));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, replace my data' }));
    expect(await screen.findByText(/complete setup/i)).toBeInTheDocument();
  });
});
