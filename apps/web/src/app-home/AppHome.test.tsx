import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContractStorage } from '@solokit/tool-contract';
import { makeContract } from '@solokit/tool-contract/testing';
import { createMemoryStore, type DataStore } from '@solokit/storage';
import { createInvoiceStorage } from '@solokit/tool-invoice';
import { makeInvoice, makeSeller } from '@solokit/tool-invoice/testing';
import { navigate } from '../setup/navigate';
import { StoreProvider } from '../store/StoreProvider';
import { AppHome } from './AppHome';

const push = vi.fn();
vi.mock('../setup/navigate', () => ({ navigate: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/app/' }));

/** A Wednesday morning, in local time. */
const MORNING = new Date(2026, 9, 21, 9, 30);

function renderHome(store: DataStore, { persistent = true, now = MORNING } = {}) {
  render(
    <StoreProvider factory={() => store} persistent={persistent}>
      <AppHome now={() => now} />
    </StoreProvider>,
  );
}

async function setUp(store = createMemoryStore()) {
  await createInvoiceStorage(store).profile.save(makeSeller({ name: 'Asha Rao Consulting' }));
  return store;
}

const searchBox = () => screen.getByRole('searchbox', { name: 'Search tools and actions' });

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.mocked(navigate).mockClear();
  push.mockClear();
  vi.restoreAllMocks();
});

describe('AppHome', () => {
  it('sends a business that is not set up to setup, which comes back here with a welcome', async () => {
    renderHome(createMemoryStore());
    expect(screen.getByText('Opening SoloKit…')).toBeInTheDocument();
    const href = '/app/setup/?next=%2Fapp%2F%3Fwelcome%3D1';
    expect(await screen.findByRole('link', { name: 'Go to setup' })).toHaveAttribute('href', href);
    expect(navigate).toHaveBeenCalledWith(href, { replace: true });
  });

  it('greets the business by the time of day, with the date', async () => {
    renderHome(await setUp());
    expect(await screen.findByRole('heading', { level: 1, name: 'Good morning, Asha Rao Consulting' })).toBeInTheDocument();
    expect(screen.getByText('Wednesday, 21 October')).toBeInTheDocument();
    expect(searchBox()).toHaveAttribute('placeholder', 'Search: invoice, quotation, NDA…');
  });

  it('says good evening in the evening', async () => {
    renderHome(await setUp(), { now: new Date(2026, 9, 21, 19, 0) });
    expect(await screen.findByRole('heading', { level: 1, name: /^Good evening/ })).toBeInTheDocument();
  });

  it('offers quick actions that start a document in the right tool', async () => {
    renderHome(await setUp());
    const actions = within(await screen.findByRole('region', { name: 'Quick actions' }));
    expect(actions.getByRole('link', { name: /New quotation/ })).toHaveAttribute('href', '/app/invoice/?new=quote');
    expect(actions.getByRole('link', { name: /New mutual NDA/ })).toHaveAttribute('href', '/app/contract/?new=nda-mutual');
    expect(actions.getAllByRole('link')).toHaveLength(6);
  });

  it('lists the latest documents, newest first, each opening where it is saved', async () => {
    const store = await setUp();
    // The stores stamp the time of saving themselves.
    const at = (iso: string) => ({ now: () => new Date(iso) });
    await createInvoiceStorage(store, at('2026-10-01T10:00:00.000Z')).invoices.save(makeInvoice({ id: 'old', number: '2026-27/0001' }));
    await createInvoiceStorage(store, at('2026-10-20T10:00:00.000Z')).invoices.save(makeInvoice({ id: 'q1', kind: 'quote', number: 'QT/2026-27/0001', status: 'draft' }));
    await createContractStorage(store, { now: () => new Date('2026-10-15T10:00:00.000Z') }).save(makeContract('nda-mutual', { id: 'c1', title: 'Mutual NDA with Northwind' }));
    renderHome(store);
    const recent = within(await screen.findByRole('region', { name: 'Recent' }));
    const links = recent.getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/app/invoice/?doc=q1', '/app/contract/?doc=c1', '/app/invoice/?doc=old']);
    expect(links[0]).toHaveTextContent('Quotation QT/2026-27/0001');
    expect(links[0]).toHaveTextContent('Northwind Traders');
    expect(links[0]).toHaveTextContent('Draft');
    expect(links[1]).toHaveTextContent('Mutual NDA with Northwind');
  });

  it('says where documents will show before there are any', async () => {
    renderHome(await setUp());
    expect(await screen.findByText(/Nothing yet. The invoices, quotations and agreements you make show up here./)).toBeInTheDocument();
  });

  it('shows the tools with what is saved in each, and the ones coming soon', async () => {
    const store = await setUp();
    await createContractStorage(store).save(makeContract('nda-mutual', { id: 'c1' }));
    renderHome(store);
    const tools = within(await screen.findByRole('region', { name: 'Your tools' }));
    expect(tools.getByRole('link', { name: /Invoice generator/ })).toHaveAttribute('href', '/app/invoice/');
    expect(tools.getByRole('link', { name: /Invoice generator/ })).toHaveTextContent('Nothing saved yet');
    expect(tools.getByRole('link', { name: /Contract and NDA generator/ })).toHaveTextContent('1 saved');
    expect(tools.getByText(/Coming soon:/).closest('p')).toHaveTextContent('Time tracker');
  });

  it('searches as you type, instead of the usual sections, and Enter opens the first result', async () => {
    renderHome(await setUp());
    await userEvent.type(await screen.findByRole('searchbox'), 'nda');
    const results = within(screen.getByRole('region', { name: 'Results for “nda”' }));
    expect(results.getAllByRole('link')[0]).toHaveAttribute('href', '/app/contract/?new=nda-mutual');
    expect(screen.queryByRole('region', { name: 'Quick actions' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/\d+ results/);
    await userEvent.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/app/contract/?new=nda-mutual');
  });

  it('says when nothing matches, and Escape clears the search', async () => {
    renderHome(await setUp());
    await userEvent.type(await screen.findByRole('searchbox'), 'zebra');
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No results');
    await userEvent.keyboard('{Escape}');
    expect(searchBox()).toHaveValue('');
    expect(screen.getByRole('region', { name: 'Quick actions' })).toBeInTheDocument();
  });

  it('shows coming-soon tools in results without a link', async () => {
    renderHome(await setUp());
    await userEvent.type(await screen.findByRole('searchbox'), 'timesheet');
    const results = screen.getByRole('region', { name: 'Results for “timesheet”' });
    expect(results).toHaveTextContent('Time tracker');
    expect(results).toHaveTextContent('Coming soon');
    expect(within(results).queryByRole('link')).not.toBeInTheDocument();
  });

  it('jumps to the search with "/", but not while typing in a field', async () => {
    renderHome(await setUp());
    await screen.findByRole('searchbox');
    await userEvent.keyboard('/');
    expect(searchBox()).toHaveFocus();
    expect(searchBox()).toHaveValue('');
  });

  it('focuses the search when the sidebar sent the person here for it', async () => {
    window.history.replaceState(null, '', '/app/#search');
    renderHome(await setUp());
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveFocus());
  });

  it('welcomes the person just after setup, with focus on the message', async () => {
    window.history.replaceState(null, '', '/app/?welcome=1');
    renderHome(await setUp());
    const message = await screen.findByText('Asha Rao Consulting is set up');
    await waitFor(() => expect(document.activeElement).toContainElement(message));
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
    await screen.findByRole('region', { name: 'Quick actions' });
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
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Quick actions' })).toBeInTheDocument();
  });
});
