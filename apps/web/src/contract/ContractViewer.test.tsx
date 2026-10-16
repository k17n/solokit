import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from '../invoice/downloads';
import { ContractViewer } from './ContractViewer';
import { fakeExporter, makeStorage, seedFinal } from './testSetup';

vi.mock('../invoice/downloads', () => ({ downloadBlob: vi.fn() }));
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:view');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.clearAllMocks());

async function setup(id = 'final-nda-mutual') {
  const storage = await makeStorage();
  await seedFinal(storage.contracts);
  const onBack = vi.fn();
  const onEdit = vi.fn();
  const exporter = fakeExporter();
  render(<ContractViewer storage={storage.contracts} invoice={storage.invoice} contractId={id} onBack={onBack} onEdit={onEdit} exporter={exporter} />);
  return { ...storage, onBack, onEdit, exporter };
}

describe('ContractViewer', () => {
  it('shows a final agreement as locked, with its review summary and downloads', async () => {
    const { exporter } = await setup();
    expect(await screen.findByRole('heading', { level: 2, name: 'Final nda-mutual' })).toBeInTheDocument();
    expect(screen.getByText('This agreement is final')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Questions for your lawyer' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Download Word' }));
    await waitFor(() => expect(exporter).toHaveBeenCalledWith('docx', expect.objectContaining({ contract: expect.objectContaining({ status: 'final' }) })));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
  });

  it('reopens only after a confirmation, then opens the draft in the editor', async () => {
    const { contracts, onEdit } = await setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Reopen to edit' }));
    expect(screen.getByText(/Reopen this agreement\? It becomes a draft again/)).toHaveFocus();
    expect((await contracts.get('final-nda-mutual'))?.status).toBe('final');
    await userEvent.click(screen.getByRole('button', { name: 'Yes, reopen' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith('final-nda-mutual'));
    expect((await contracts.get('final-nda-mutual'))?.status).toBe('draft');
  });

  it('Keep it final cancels and returns focus', async () => {
    const { contracts, onEdit } = await setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Reopen to edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep it final' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reopen to edit' })).toHaveFocus());
    expect(onEdit).not.toHaveBeenCalled();
    expect((await contracts.get('final-nda-mutual'))?.status).toBe('final');
  });

  it('duplicates into a draft', async () => {
    const { contracts, onEdit } = await setup();
    await userEvent.click(await screen.findByRole('button', { name: 'Duplicate as a new draft' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
    expect((await contracts.list()).filter((contract) => contract.status === 'draft')).toHaveLength(1);
  });

  it('says so when the agreement does not exist', async () => {
    const { onBack } = await setup('nope');
    expect(await screen.findByText('The agreement could not be opened')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to agreements' }));
    expect(onBack).toHaveBeenCalled();
  });
});
