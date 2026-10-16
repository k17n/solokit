import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createContractStorage } from '@solokit/tool-contract';
import { makeContract } from '@solokit/tool-contract/testing';
import { createMemoryStore, type DataStore } from '@solokit/storage';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeSeller } from '@solokit/tool-invoice/testing';
import { StoreProvider } from '../store/StoreProvider';
import { ContractApp } from './ContractApp';
import { InvoiceApp } from '../invoice/InvoiceApp';
import { NOW, fakeExporter } from './testSetup';

function renderContract(store: DataStore) {
  render(
    <StoreProvider factory={() => store}>
      <ContractApp exporter={fakeExporter()} now={() => NOW} />
    </StoreProvider>,
  );
}

describe('first use of the contract tool', () => {
  beforeEach(() => {
    // A fresh, working localStorage for each test (the one Node provides may be missing its methods).
    const items = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (name: string) => items.get(name) ?? null,
      setItem: (name: string, value: string) => void items.set(name, value),
      removeItem: (name: string) => void items.delete(name),
    });
  });

  it('asks a Business with no details for name, address and email, saves them to the shared profile, and opens the tool', async () => {
    const store = createMemoryStore();
    renderContract(store);
    const heading = await screen.findByRole('heading', { name: 'Set up your business' });
    // The step moves focus to its heading once it has mounted. Typing before that lands the first key in the field and the rest nowhere.
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.queryByRole('navigation', { name: 'Contract tool' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Business or personal name'), 'Asha Rao');
    await userEvent.type(screen.getByLabelText('Address line 1'), '12 Linking Road');
    await userEvent.type(screen.getByLabelText('City'), 'Mumbai');
    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByRole('navigation', { name: 'Contract tool' })).toBeInTheDocument();
    const saved = await createInvoiceStorage(store).profile.get();
    expect(saved).toMatchObject({ name: 'Asha Rao', email: 'asha@example.com', gstUnconfirmed: true });
    expect((await createInvoiceStorage(store).settings.get()).onboarded).toBe(true);
  });

  it('opens straight away when the shared profile has everything the tool needs, with no mention of the invoice tool', async () => {
    const store = createMemoryStore();
    await createInvoiceStorage(store).profile.save(makeSeller());
    renderContract(store);
    expect(await screen.findByRole('navigation', { name: 'Contract tool' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Set up your business' })).not.toBeInTheDocument();
    expect(screen.queryByText(/invoice tool/i)).not.toBeInTheDocument();
  });

  it('asks only for the missing email when the rest is there', async () => {
    const store = createMemoryStore();
    await createInvoiceStorage(store).profile.save(makeSeller({ email: undefined }));
    renderContract(store);
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByLabelText('Business or personal name')).not.toBeInTheDocument();
  });

  it('can be skipped, and then points to the Your business page instead of the invoice tool', async () => {
    const store = createMemoryStore();
    renderContract(store);
    await userEvent.click(await screen.findByRole('button', { name: 'Skip for now' }));
    expect(await screen.findByRole('navigation', { name: 'Contract tool' })).toBeInTheDocument();
    expect(await createInvoiceStorage(store).profile.get()).toBeUndefined();
    await userEvent.click(await screen.findByRole('button', { name: /Mutual NDA/ }));
    expect(await screen.findByRole('link', { name: 'Your business' })).toHaveAttribute('href', '/business/');
  });

  it('remembers a skip, so the step does not come back on the next visit', async () => {
    const store = createMemoryStore();
    const first = render(
      <StoreProvider factory={() => store}>
        <ContractApp now={() => NOW} />
      </StoreProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Skip for now' }));
    await screen.findByRole('navigation', { name: 'Contract tool' });
    first.unmount();
    renderContract(store);
    expect(await screen.findByRole('navigation', { name: 'Contract tool' })).toBeInTheDocument();
  });

  it('does not stop someone who already has agreements', async () => {
    const store = createMemoryStore();
    await createContractStorage(store, { now: () => NOW }).save(makeContract('nda-mutual', { id: 'old', title: 'Old NDA' }));
    renderContract(store);
    expect(await screen.findByRole('navigation', { name: 'Contract tool' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Set up your business' })).not.toBeInTheDocument();
  });

  it('then lets the invoice tool ask only for the GST status', async () => {
    const store = createMemoryStore();
    renderContract(store);
    const field = await screen.findByLabelText('Business or personal name');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Set up your business' })).toHaveFocus());
    await userEvent.type(field, 'Asha Rao');
    await userEvent.type(screen.getByLabelText('Address line 1'), '12 Linking Road');
    await userEvent.type(screen.getByLabelText('City'), 'Mumbai');
    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await screen.findByRole('navigation', { name: 'Contract tool' });

    render(
      <StoreProvider factory={() => store}>
        <InvoiceApp />
      </StoreProvider>,
    );
    const group = await screen.findByRole('group', { name: 'How are you registered for GST?' });
    expect(group).toBeInTheDocument();
    expect(screen.queryByLabelText('Business or personal name')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Not registered for GST/ }));
    const buttons = screen.getAllByRole('button', { name: 'Save and continue' });
    await userEvent.click(buttons[buttons.length - 1]!);
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Invoice tool' })).toBeInTheDocument());
    const saved = await createInvoiceStorage(store).profile.get();
    expect(saved).toMatchObject({ name: 'Asha Rao', gstStatus: 'unregistered' });
    expect(saved).not.toHaveProperty('gstUnconfirmed');
  });
});
