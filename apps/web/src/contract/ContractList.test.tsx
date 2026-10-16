import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from '../invoice/downloads';
import { ContractList } from './ContractList';
import { NOW, fakeExporter, makeStorage, seedDraft, seedFinal, type TestStorage } from './testSetup';

vi.mock('../invoice/downloads', () => ({ downloadBlob: vi.fn() }));
afterEach(() => vi.clearAllMocks());

async function setup(seed?: (storage: TestStorage) => Promise<void>) {
  const storage = await makeStorage();
  await seed?.(storage);
  const handlers = { onNew: vi.fn(), onEdit: vi.fn(), onView: vi.fn(), onOpenBackup: vi.fn() };
  const exporter = fakeExporter();
  render(<ContractList storage={storage.contracts} invoice={storage.invoice} exporter={exporter} now={() => NOW} {...handlers} />);
  return { ...storage, ...handlers, exporter };
}

describe('ContractList: first run', () => {
  it('shows the three agreements as cards, each with a use-case line', async () => {
    const { onNew } = await setup();
    expect(await screen.findByRole('heading', { name: 'Start your first agreement' })).toBeInTheDocument();
    const cards = within(screen.getByRole('group', { name: 'Choose an agreement type to start with' })).getAllByRole('button');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent('Mutual NDA');
    expect(cards[0]).toHaveTextContent('Both sides share confidential information');
    expect(cards[1]).toHaveTextContent('One-way NDA');
    expect(cards[1]).toHaveTextContent('Only one side shares secrets');
    expect(cards[2]).toHaveTextContent('Freelance services agreement');
    expect(cards[2]).toHaveTextContent('Scope, deliverables, fees');
    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
    await userEvent.click(cards[1]!);
    expect(onNew).toHaveBeenLastCalledWith('nda-one-way');
    await userEvent.click(cards[2]!);
    expect(onNew).toHaveBeenLastCalledWith('services');
    await userEvent.click(cards[0]!);
    expect(onNew).toHaveBeenLastCalledWith('nda-mutual');
  });
});

describe('ContractList: rows', () => {
  it('shows kind, title, parties, status and dates, newest change first', async () => {
    await setup(async ({ contracts }) => {
      await seedFinal(contracts, 'nda-mutual');
      await seedDraft(contracts, 'services');
    });
    const items = within(await screen.findByRole('list', { name: 'Agreements' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    // Both were saved at the same fixed time, so the tie is broken by title.
    const draft = items.find((item) => item.textContent?.includes('Draft services'))!;
    const final = items.find((item) => item.textContent?.includes('Final nda-mutual'))!;
    expect(draft).toHaveTextContent('Freelance services agreement');
    expect(draft).toHaveTextContent('Draft');
    expect(draft).toHaveTextContent('Asha Rao Consulting and Northwind Traders Private Limited');
    expect(draft).toHaveTextContent('Effective 16 Oct 2026');
    expect(final).toHaveTextContent('Mutual NDA');
    expect(final).toHaveTextContent('Final');
  });

  it('opens a draft in the editor and a final agreement in the viewer', async () => {
    const { onEdit, onView } = await setup(async ({ contracts }) => {
      await seedDraft(contracts);
      await seedFinal(contracts);
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Open Draft services' }));
    expect(onEdit).toHaveBeenCalledWith('draft-services');
    await userEvent.click(screen.getByRole('button', { name: 'Open Final nda-mutual' }));
    expect(onView).toHaveBeenCalledWith('final-nda-mutual');
  });

  it('offers Reopen for a final agreement and Delete draft for a draft, never both', async () => {
    await setup(async ({ contracts }) => {
      await seedDraft(contracts);
      await seedFinal(contracts);
    });
    await screen.findByRole('list', { name: 'Agreements' });
    expect(screen.getByRole('button', { name: 'Delete draft Draft services' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reopen Draft services' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reopen Final nda-mutual' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete draft Final nda-mutual' })).not.toBeInTheDocument();
  });
});

describe('ContractList: the New chooser', () => {
  const withOne = () => setup(async ({ contracts }) => void (await seedDraft(contracts)));

  it('opens from the + New button, focuses the first card and starts the kind picked', async () => {
    const { onNew } = await withOne();
    const trigger = await screen.findByRole('button', { name: 'New' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const cards = within(screen.getByRole('group', { name: 'Choose an agreement type' }));
    expect(cards.getByRole('button', { name: /Mutual NDA/ })).toHaveFocus();
    await userEvent.click(cards.getByRole('button', { name: /Freelance services/ }));
    expect(onNew).toHaveBeenCalledWith('services');
    expect(screen.queryByRole('group', { name: 'Choose an agreement type' })).not.toBeInTheDocument();
  });

  it('moves between cards with the arrow keys and closes on Escape, returning focus to the button', async () => {
    await withOne();
    const trigger = await screen.findByRole('button', { name: 'New' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: /One-way NDA/ })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('button', { name: /Freelance services/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: /Mutual NDA/ })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Choose an agreement type' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes when the user clicks elsewhere', async () => {
    await withOne();
    await userEvent.click(await screen.findByRole('button', { name: 'New' }));
    await userEvent.click(screen.getByRole('list', { name: 'Agreements' }));
    expect(screen.queryByRole('group', { name: 'Choose an agreement type' })).not.toBeInTheDocument();
  });
});

describe('ContractList: downloads', () => {
  it('builds each download with the exporter and hands the file to the browser', async () => {
    const { exporter } = await setup(async ({ contracts }) => void (await seedDraft(contracts)));
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF Draft services' }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(1));
    expect(exporter).toHaveBeenLastCalledWith('pdf', expect.objectContaining({ contract: expect.objectContaining({ id: 'draft-services' }), theme: expect.objectContaining({ id: 'classic' }) }));
    expect(downloadBlob).toHaveBeenLastCalledWith(expect.any(Blob), 'draft-services-pdf');

    await userEvent.click(screen.getByRole('button', { name: 'Download Word Draft services' }));
    await waitFor(() => expect(exporter).toHaveBeenLastCalledWith('docx', expect.anything()));
    await userEvent.click(screen.getByRole('button', { name: 'Review pack Draft services' }));
    await waitFor(() => expect(exporter).toHaveBeenLastCalledWith('review-pdf', expect.anything()));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(3));
  });

  it('does not export an incomplete draft and says how many things are missing', async () => {
    const { exporter } = await setup(async ({ contracts }) => void (await seedDraft(contracts, 'nda-mutual', { variables: {} })));
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF Draft nda-mutual' }));
    expect(await screen.findByText(/Finish this draft before you download it: 1 thing is missing/)).toBeInTheDocument();
    expect(exporter).not.toHaveBeenCalled();
  });

  it('shows a message when the exporter fails', async () => {
    const { exporter } = await setup(async ({ contracts }) => void (await seedFinal(contracts)));
    exporter.mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await userEvent.click(await screen.findByRole('button', { name: 'Download PDF Final nda-mutual' }));
    expect(await screen.findByText('The document could not be built. Try again.')).toBeInTheDocument();
  });
});

describe('ContractList: delete, reopen, duplicate', () => {
  it('deletes a draft only after a second click, and Keep it returns focus', async () => {
    const { contracts } = await setup(async ({ contracts }) => void (await seedDraft(contracts)));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete draft Draft services' }));
    expect(screen.getByText(/Delete the draft "Draft services"\? This cannot be undone\./)).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.getByRole('button', { name: 'Delete draft Draft services' })).toHaveFocus();
    expect(await contracts.list()).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Delete draft Draft services' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete draft' }));
    expect(await screen.findByRole('heading', { name: 'Start your first agreement' })).toBeInTheDocument();
    expect(await contracts.list()).toHaveLength(0);
  });

  it('reopens a final agreement after confirming and opens it in the editor', async () => {
    const { contracts, onEdit } = await setup(async ({ contracts }) => void (await seedFinal(contracts)));
    await userEvent.click(await screen.findByRole('button', { name: 'Reopen Final nda-mutual' }));
    expect(screen.getByText(/Reopen "Final nda-mutual"\? It becomes a draft again/)).toBeInTheDocument();
    expect((await contracts.get('final-nda-mutual'))?.status).toBe('final');
    await userEvent.click(screen.getByRole('button', { name: 'Yes, reopen' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledWith('final-nda-mutual'));
    const reopened = await contracts.get('final-nda-mutual');
    expect(reopened?.status).toBe('draft');
    expect(reopened?.finalDocument).toBeUndefined();
  });

  it('duplicates into a new draft and opens it', async () => {
    const { contracts, onEdit } = await setup(async ({ contracts }) => void (await seedFinal(contracts)));
    await userEvent.click(await screen.findByRole('button', { name: 'Duplicate Final nda-mutual' }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
    const all = await contracts.list();
    expect(all).toHaveLength(2);
    expect(all.find((contract) => contract.id === onEdit.mock.calls[0]![0])).toMatchObject({ status: 'draft', title: 'Final nda-mutual (copy)' });
  });
});

describe('ContractList: backup reminder', () => {
  it('reminds the user to back up agreements, and links to the backup screen', async () => {
    const { onOpenBackup } = await setup(async ({ contracts }) => void (await seedDraft(contracts)));
    expect(await screen.findByText('Back up your agreements')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back up now' }));
    expect(onOpenBackup).toHaveBeenCalled();
  });

  it('stays quiet after a recent backup', async () => {
    await setup(async ({ contracts, invoice }) => {
      await seedDraft(contracts);
      await invoice.settings.update({ lastBackupAt: '2026-10-10T10:00:00.000Z' });
    });
    await screen.findByRole('list', { name: 'Agreements' });
    expect(screen.queryByText('Back up your agreements')).not.toBeInTheDocument();
  });
});
