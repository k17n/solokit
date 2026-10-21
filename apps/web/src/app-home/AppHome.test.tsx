import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContractStorage } from '@solokit/tool-contract';
import { makeContract } from '@solokit/tool-contract/testing';
import { createMemoryStore, type DataStore } from '@solokit/storage';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { navigate } from '../setup/navigate';
import { StoreProvider } from '../store/StoreProvider';
import { AppHome } from './AppHome';

vi.mock('../setup/navigate', () => ({ navigate: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/app/' }));

const NOW = new Date('2026-10-21T10:00:00Z');

function renderHome(store: DataStore, { persistent = true } = {}) {
  render(
    <StoreProvider factory={() => store} persistent={persistent}>
      <AppHome now={() => NOW} />
    </StoreProvider>,
  );
}

async function setUp(store = createMemoryStore()) {
  await createInvoiceStorage(store).profile.save(makeSeller({ name: 'Asha Rao Consulting' }));
  return store;
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.mocked(navigate).mockClear();
  vi.restoreAllMocks();
});

describe('AppHome', () => {
  it('sends a business that is not set up to setup, which comes back here with a welcome', async () => {
    renderHome(createMemoryStore());
    expect(screen.getByText('Opening your tools…')).toBeInTheDocument();
    const href = '/app/setup/?next=%2Fapp%2F%3Fwelcome%3D1';
    expect(await screen.findByRole('link', { name: 'Go to setup' })).toHaveAttribute('href', href);
    expect(navigate).toHaveBeenCalledWith(href, { replace: true });
  });

  it('lists the ready tools with what is in each, and the ones coming soon', async () => {
    const store = await setUp();
    await createInvoiceStorage(store).invoices.save(makeInvoice({ id: 'i1' }));
    await createInvoiceStorage(store).invoices.save(makeInvoice({ id: 'i2', number: '2026-27/0002' }));
    renderHome(store);
    const ready = within(await screen.findByRole('region', { name: 'Ready to use' }));
    expect(ready.getByRole('link', { name: /Invoice generator/ })).toHaveAttribute('href', '/app/invoice/');
    expect(ready.getByRole('link', { name: /Invoice generator/ })).toHaveTextContent('2 invoices and quotations');
    expect(ready.getByRole('link', { name: /Contract and NDA generator/ })).toHaveTextContent('Make your first NDA or services agreement');
    const soon = within(screen.getByRole('region', { name: 'Coming soon' }));
    expect(soon.getByText('Time tracker')).toBeInTheDocument();
    expect(soon.queryByRole('link')).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('counts agreements', async () => {
    const store = await setUp();
    await createContractStorage(store).save(makeContract('nda-mutual', { id: 'c1' }));
    renderHome(store);
    expect(await screen.findByRole('link', { name: /Contract and NDA generator/ })).toHaveTextContent('1 agreement');
  });

  it('shows the business, with links to edit its details and to backups', async () => {
    renderHome(await setUp());
    const business = within(await screen.findByRole('region', { name: 'This business' }));
    expect(business.getByText('Asha Rao Consulting')).toBeInTheDocument();
    expect(business.getByText(/Regular GST registration · 27AAPFU0939F1ZV · Mumbai/)).toBeInTheDocument();
    expect(business.getByRole('link', { name: 'Edit business details' })).toHaveAttribute('href', '/app/setup/?next=%2Fapp%2F');
    expect(business.getByRole('link', { name: 'Backups and other businesses' })).toHaveAttribute('href', '/app/business/');
  });

  it('welcomes the person just after setup, with focus on the message', async () => {
    window.history.replaceState(null, '', '/app/?welcome=1');
    renderHome(await setUp());
    const message = await screen.findByText('Asha Rao Consulting is set up');
    await waitFor(() => expect(document.activeElement).toContainElement(message));
  });

  it('does not welcome on later visits', async () => {
    renderHome(await setUp());
    await screen.findByRole('region', { name: 'Ready to use' });
    expect(screen.queryByText(/is set up$/)).not.toBeInTheDocument();
  });

  it('asks for a backup once there is work and none was made', async () => {
    const store = await setUp();
    await createInvoiceStorage(store).invoices.save(makeInvoice({ id: 'i1' }));
    renderHome(store);
    expect(await screen.findByText('Back up your work')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download a backup' })).toHaveAttribute('href', '/app/business/#backup');
  });

  it('does not ask for a backup before there is anything to lose', async () => {
    renderHome(await setUp());
    await screen.findByRole('region', { name: 'Ready to use' });
    expect(screen.queryByText('Back up your work')).not.toBeInTheDocument();
  });

  it('warns when the browser is not saving data', async () => {
    renderHome(await setUp(), { persistent: false });
    expect(await screen.findByText('Your browser is not saving data')).toBeInTheDocument();
  });

  it('offers to try again when the business cannot be read', async () => {
    const inner = await setUp();
    let failing = true;
    const store: DataStore = { ...inner, get: (collection, id) => (failing ? Promise.reject(new Error('read failed')) : inner.get(collection, id)) };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHome(store);
    expect(await screen.findByText('Your saved details could not be opened')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    failing = false;
    screen.getByRole('button', { name: 'Try again' }).click();
    expect(await screen.findByRole('region', { name: 'Ready to use' })).toBeInTheDocument();
  });
});
