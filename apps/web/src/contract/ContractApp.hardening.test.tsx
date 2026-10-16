import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createContractStorage } from '@solokit/tool-contract';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeSeller } from '@solokit/tool-invoice/testing';
import { StoreProvider } from '../store/StoreProvider';
import { ContractApp } from './ContractApp';
import { NOW, fakeExporter } from './testSetup';

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview-1');
  URL.revokeObjectURL = vi.fn();
});

function renderApp() {
  const store = createMemoryStore();
  // A Business that has already given its details, so the tool opens straight away.
  void createInvoiceStorage(store).profile.save(makeSeller());
  render(
    <StoreProvider factory={() => store}>
      <ContractApp exporter={fakeExporter()} now={() => NOW} />
    </StoreProvider>,
  );
  return store;
}

async function startMutual() {
  await userEvent.click(await screen.findByRole('button', { name: /Mutual NDA/ }));
  await userEvent.type(await screen.findByLabelText('Second Party: full name'), 'Northwind');
}

const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Contract tool' })).getByRole('button', { name });

describe('ContractApp: tabs and unsaved changes', () => {
  it('asks before a tab click throws away unsaved changes, just as the Back button does', async () => {
    renderApp();
    await startMutual();
    await userEvent.click(tab('Backup & restore'));
    expect(await screen.findByText('You have changes that are not saved.')).toBeInTheDocument();
    // Nothing has moved yet.
    expect(tab('Agreements')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('button', { name: 'Download backup' })).not.toBeInTheDocument();
  });

  it('stays in the editor, with the typing intact, when the person keeps editing', async () => {
    renderApp();
    await startMutual();
    await userEvent.click(tab('Backup & restore'));
    await userEvent.click(await screen.findByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Second Party: full name')).toHaveValue('Northwind');
    expect(tab('Agreements')).toHaveAttribute('aria-current', 'page');
    // The Back button still goes to the list, not to the tab that was clicked earlier.
    await userEvent.click(screen.getByRole('button', { name: 'Back to agreements' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Leave without saving' }));
    expect(await screen.findByRole('heading', { name: 'Start your first agreement' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download backup' })).not.toBeInTheDocument();
  });

  it('goes to the clicked tab after "Leave without saving", and nothing was saved', async () => {
    const store = renderApp();
    await startMutual();
    await userEvent.click(tab('Backup & restore'));
    await userEvent.click(await screen.findByRole('button', { name: 'Leave without saving' }));
    expect(await screen.findByRole('button', { name: 'Download backup' })).toBeInTheDocument();
    expect(tab('Backup & restore')).toHaveAttribute('aria-current', 'page');
    expect(await createContractStorage(store).list()).toEqual([]);
  });

  it('saves the draft and then goes to the clicked tab after "Save draft and leave"', async () => {
    const store = renderApp();
    await startMutual();
    await userEvent.click(tab('Backup & restore'));
    await userEvent.click(await screen.findByRole('button', { name: 'Save draft and leave' }));
    expect(await screen.findByRole('button', { name: 'Download backup' })).toBeInTheDocument();
    expect((await createContractStorage(store).list()).map((contract) => contract.parties[1]?.name)).toEqual(['Northwind']);
  });

  it('asks when the Agreements tab itself is clicked from the editor', async () => {
    renderApp();
    await startMutual();
    await userEvent.click(tab('Agreements'));
    expect(await screen.findByText('You have changes that are not saved.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Leave without saving' }));
    expect(await screen.findByRole('heading', { name: 'Start your first agreement' })).toBeInTheDocument();
  });

  it('does not ask when there is nothing unsaved', async () => {
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /Mutual NDA/ }));
    await screen.findByLabelText('Second Party: full name');
    await userEvent.click(tab('Backup & restore'));
    expect(await screen.findByRole('button', { name: 'Download backup' })).toBeInTheDocument();
    expect(screen.queryByText('You have changes that are not saved.')).not.toBeInTheDocument();
  });

  it('does not ask after the draft was saved', async () => {
    renderApp();
    await startMutual();
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Draft saved');
    await userEvent.click(tab('Backup & restore'));
    expect(await screen.findByRole('button', { name: 'Download backup' })).toBeInTheDocument();
  });

  it('does not keep guarding the page after the editor is closed', async () => {
    renderApp();
    await startMutual();
    await userEvent.click(tab('Backup & restore'));
    await userEvent.click(await screen.findByRole('button', { name: 'Leave without saving' }));
    await screen.findByRole('button', { name: 'Download backup' });
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
