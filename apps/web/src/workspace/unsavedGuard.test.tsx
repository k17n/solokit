import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore } from '@solokit/storage';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeSeller } from '@solokit/tool-invoice/testing';
import { makeManager } from '../business/testWorkspaces';
import { ManageBusinesses } from '../business/ManageBusinesses';
import { ContractEditor } from '../contract/ContractEditor';
import { NOW as CONTRACT_NOW, fakeExporter, makeStorage as makeContractStorage } from '../contract/testSetup';
import { InvoiceEditor } from '../invoice/InvoiceEditor';
import { BusinessSwitcher } from './BusinessSwitcher';
import { UnsavedGuardProvider, useConfirmLeave, useUnsavedGuard } from './unsavedGuard';
import { WorkspacesProvider, WorkspaceStore, useWorkspaces, type WorkspacesState } from './WorkspaceProvider';

beforeEach(() => {
  let counter = 0;
  Object.assign(URL, { createObjectURL: vi.fn(() => `blob:fake-${++counter}`), revokeObjectURL: vi.fn() });
});

let latest: WorkspacesState;

/** A stand-in editor: dirty when told to be, saving through a function the test controls. */
function FakeEditor({ dirty, save }: { dirty: boolean; save?: () => Promise<boolean> }) {
  useUnsavedGuard('fake', dirty, save);
  latest = useWorkspaces();
  return <p>editor in {latest.current?.name}</p>;
}

function Leaver() {
  const confirmLeave = useConfirmLeave();
  const [outcome, setOutcome] = useState('not asked');
  return (
    <>
      <button type="button" onClick={() => void confirmLeave().then((proceed) => setOutcome(proceed ? 'proceed' : 'stay'))}>
        Try to leave
      </button>
      <p data-testid="outcome">{outcome}</p>
    </>
  );
}

async function setupSwitcher(editor: { dirty: boolean; save?: () => Promise<boolean> }, extra?: React.ReactNode) {
  const { manager } = makeManager();
  render(
    <WorkspacesProvider manager={manager}>
      <header>
        <BusinessSwitcher />
      </header>
      <WorkspaceStore>
        <FakeEditor dirty={editor.dirty} {...(editor.save ? { save: editor.save } : {})} />
      </WorkspaceStore>
      {extra}
    </WorkspacesProvider>,
  );
  await screen.findByText('editor in My business');
  await act(async () => {
    await latest.create('Studio Two', { switchTo: false });
  });
  return manager;
}

async function chooseStudioTwo() {
  await userEvent.click(screen.getByRole('button', { name: /^Business/ }));
  await userEvent.click(await screen.findByRole('button', { name: 'Studio Two' }));
}

describe('switching business with unsaved work', () => {
  it('switches straight away when nothing is unsaved', async () => {
    await setupSwitcher({ dirty: false });
    await chooseStudioTwo();
    expect(await screen.findByText('editor in Studio Two')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('asks first when an editor is dirty, and Stay changes nothing', async () => {
    const save = vi.fn(async () => true);
    await setupSwitcher({ dirty: true, save });
    await chooseStudioTwo();
    const dialog = await screen.findByRole('alertdialog', { name: 'Switch anyway?' });
    expect(dialog).toHaveTextContent('Unsaved changes will be lost.');
    expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Save draft and switch', 'Switch without saving', 'Stay']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByText('editor in My business')).toBeInTheDocument();
    expect(latest.current?.name).toBe('My business');
    expect(save).not.toHaveBeenCalled();
  });

  it('Escape is the same as Stay', async () => {
    await setupSwitcher({ dirty: true, save: async () => true });
    await chooseStudioTwo();
    await screen.findByRole('alertdialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(latest.current?.name).toBe('My business');
  });

  it('Switch without saving switches and never saves', async () => {
    const save = vi.fn(async () => true);
    await setupSwitcher({ dirty: true, save });
    await chooseStudioTwo();
    await userEvent.click(await screen.findByRole('button', { name: 'Switch without saving' }));
    expect(await screen.findByText('editor in Studio Two')).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  it('Save draft and switch saves first, then switches', async () => {
    const order: string[] = [];
    const save = vi.fn(async () => {
      order.push('saved');
      return true;
    });
    await setupSwitcher({ dirty: true, save });
    await chooseStudioTwo();
    await userEvent.click(await screen.findByRole('button', { name: 'Save draft and switch' }));
    expect(await screen.findByText('editor in Studio Two')).toBeInTheDocument();
    expect(order).toEqual(['saved']);
  });

  it('stays, and says so, when the draft could not be saved', async () => {
    const save = vi.fn(async () => false);
    await setupSwitcher({ dirty: true, save });
    await chooseStudioTwo();
    await userEvent.click(await screen.findByRole('button', { name: 'Save draft and switch' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be saved/i);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(latest.current?.name).toBe('My business');
  });

  it('offers only switching without saving or staying when the editor cannot save', async () => {
    await setupSwitcher({ dirty: true });
    await chooseStudioTwo();
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Switch without saving', 'Stay']);
  });

  it('asks again from the Your businesses list', async () => {
    const { manager } = makeManager();
    render(
      <WorkspacesProvider manager={manager}>
        <WorkspaceStore>
          <FakeEditor dirty save={async () => true} />
        </WorkspaceStore>
        <ManageBusinesses />
      </WorkspacesProvider>,
    );
    await screen.findByText('editor in My business');
    await act(async () => {
      await latest.create('Studio Two', { switchTo: false });
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Switch to Studio Two' }));
    await screen.findByRole('alertdialog');
    expect(latest.current?.name).toBe('My business');
    await userEvent.click(screen.getByRole('button', { name: 'Switch without saving' }));
    expect(await screen.findByText('editor in Studio Two')).toBeInTheDocument();
  });

  it('forgets an editor that is no longer on screen', async () => {
    function Page() {
      const [open, setOpen] = useState(true);
      return (
        <UnsavedGuardProvider>
          {open ? <GuardOnly /> : null}
          <button type="button" onClick={() => setOpen(false)}>
            close editor
          </button>
          <Leaver />
        </UnsavedGuardProvider>
      );
    }
    function GuardOnly() {
      useUnsavedGuard('x', true);
      return null;
    }
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'close editor' }));
    await userEvent.click(screen.getByRole('button', { name: 'Try to leave' }));
    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('proceed'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('the real editors tell the guard when they hold unsaved work', () => {
  it('the invoice editor is clean when untouched, dirty once edited, and clean again after Save draft', async () => {
    const storage = createInvoiceStorage(createMemoryStore(), { now: () => new Date(2026, 9, 14, 10, 0) });
    const profile = makeSeller();
    await storage.profile.save(profile);
    render(
      <UnsavedGuardProvider>
        <InvoiceEditor storage={storage} profile={profile} onBack={vi.fn()} onIssued={vi.fn()} renderPdf={async () => new Blob(['pdf'])} now={() => new Date(2026, 9, 14, 10, 0)} />
        <Leaver />
      </UnsavedGuardProvider>,
    );
    await screen.findByRole('heading', { name: /^New / });
    await screen.findByLabelText('Invoice number');

    await userEvent.click(screen.getByRole('button', { name: 'Try to leave' }));
    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('proceed'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Client name'), 'Northwind Traders');
    await userEvent.type(screen.getByLabelText('Address line 1'), '4 MG Road');
    await userEvent.type(screen.getByLabelText('City'), 'Pune');
    await userEvent.selectOptions(screen.getByLabelText('State'), '27');
    const item = within(screen.getByRole('group', { name: 'Item 1' }));
    await userEvent.type(item.getByLabelText('Description'), 'Consulting');
    await userEvent.type(item.getByLabelText('Rate (₹)'), '3000');
    await userEvent.click(screen.getByRole('button', { name: 'Try to leave' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('stay'));

    await userEvent.click(screen.getByRole('button', { name: 'Try to leave' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Save draft and switch' }));
    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('proceed'));
    expect(await storage.invoices.list()).toHaveLength(1);

    // Saved, so there is nothing left to ask about.
    await userEvent.click(screen.getByRole('button', { name: 'Try to leave' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('outcome')).toHaveTextContent('proceed');
  });

  it('the invoice editor notices a change to an existing draft too', async () => {
    const storage = createInvoiceStorage(createMemoryStore(), { now: () => new Date(2026, 9, 14, 10, 0) });
    const profile = makeSeller();
    await storage.profile.save(profile);
    const { makeInvoice } = await import('@solokit/tool-invoice/testing');
    await storage.invoices.save(makeInvoice({ id: 'd1', status: 'draft' }));
    render(
      <UnsavedGuardProvider>
        <InvoiceEditor storage={storage} profile={profile} invoiceId="d1" onBack={vi.fn()} onIssued={vi.fn()} renderPdf={async () => new Blob(['pdf'])} now={() => new Date(2026, 9, 14, 10, 0)} />
        <Leaver />
      </UnsavedGuardProvider>,
    );
    await screen.findByRole('heading', { name: 'Edit draft' });
    await userEvent.click(screen.getByRole('button', { name: 'Try to leave' }));
    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('proceed'));
    await userEvent.type(screen.getByLabelText('Client name'), ' Ltd');
    await userEvent.click(screen.getByRole('button', { name: 'Try to leave' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('the contract editor is clean when untouched, dirty once edited, and saves its draft on the way out', async () => {
    const storage = await makeContractStorage({ profile: true });
    render(
      <UnsavedGuardProvider>
        <ContractEditor storage={storage.contracts} invoice={storage.invoice} initialKind="nda-mutual" onBack={vi.fn()} onFinalised={vi.fn()} exporter={fakeExporter()} now={() => CONTRACT_NOW} />
        <Leaver />
      </UnsavedGuardProvider>,
    );
    await screen.findByRole('heading', { level: 3, name: /Parties/ });

    await userEvent.click(screen.getByRole('button', { name: 'Try to leave' }));
    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('proceed'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    await userEvent.type(within(screen.getByRole('group', { name: /^Party 2:/ })).getByLabelText('Second Party: full name'), 'Acme Co');
    await userEvent.click(screen.getByRole('button', { name: 'Try to leave' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Save draft and switch' }));
    await waitFor(() => expect(screen.getByTestId('outcome')).toHaveTextContent('proceed'));
    expect(await storage.contracts.list()).toHaveLength(1);
  });
});
