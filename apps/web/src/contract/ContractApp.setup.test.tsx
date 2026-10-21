import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContractStorage } from '@solokit/tool-contract';
import { makeContract } from '@solokit/tool-contract/testing';
import { createMemoryStore, type DataStore } from '@solokit/storage';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeSeller } from '@solokit/tool-invoice/testing';
import { navigate } from '../setup/navigate';
import { StoreProvider } from '../store/StoreProvider';
import { ContractApp } from './ContractApp';
import { NOW, fakeExporter } from './testSetup';

vi.mock('../setup/navigate', () => ({ navigate: vi.fn() }));

const SETUP = '/app/setup/?next=%2Fapp%2Fcontract%2F';

function renderContract(store: DataStore) {
  render(
    <StoreProvider factory={() => store}>
      <ContractApp exporter={fakeExporter()} now={() => NOW} />
    </StoreProvider>,
  );
}

afterEach(() => {
  vi.mocked(navigate).mockClear();
  vi.restoreAllMocks();
});

describe('the contract tool and the business setup', () => {
  it('sends a Business with no details to setup, to come back here', async () => {
    renderContract(createMemoryStore());
    expect(await screen.findByRole('link', { name: 'Go to setup' })).toHaveAttribute('href', SETUP);
    expect(navigate).toHaveBeenCalledWith(SETUP, { replace: true });
    expect(screen.queryByRole('navigation', { name: 'Contract tool' })).not.toBeInTheDocument();
  });

  it('sends a Business to setup when a detail another tool needs is missing, such as the GST status', async () => {
    const store = createMemoryStore();
    await createInvoiceStorage(store).profile.save(makeSeller({ gstUnconfirmed: true, gstStatus: 'unregistered', gstin: undefined }));
    renderContract(store);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(SETUP, { replace: true }));
  });

  it('sends someone with agreements but no details to setup too', async () => {
    const store = createMemoryStore();
    await createContractStorage(store, { now: () => NOW }).save(makeContract('nda-mutual', { id: 'old', title: 'Old NDA' }));
    renderContract(store);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(SETUP, { replace: true }));
  });

  it('opens straight away when setup is done, with a link to the business details that comes back here', async () => {
    const store = createMemoryStore();
    await createInvoiceStorage(store).profile.save(makeSeller());
    renderContract(store);
    expect(await screen.findByRole('navigation', { name: 'Contract tool' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Business details' })).toHaveAttribute('href', SETUP);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('says so, instead of sending the person to setup, when the details cannot be read', async () => {
    const inner = createMemoryStore();
    await createInvoiceStorage(inner).profile.save(makeSeller());
    let failing = true;
    const store: DataStore = { ...inner, get: (collection, id) => (failing ? Promise.reject(new Error('read failed')) : inner.get(collection, id)) };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderContract(store);
    expect(await screen.findByText('Your saved details could not be opened')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    failing = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('navigation', { name: 'Contract tool' })).toBeInTheDocument();
  });
});
