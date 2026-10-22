import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsavedGuardProvider, useUnsavedGuard } from '../workspace/unsavedGuard';
import { AppLink } from './AppLink';
import { AppShell } from './AppShell';

const push = vi.fn();
let pathname = '/app/';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => pathname }));
// The switcher has its own tests; here it only has to be in the bar.
vi.mock('../workspace/BusinessSwitcher', () => ({ BusinessSwitcher: () => <p>Business switcher</p> }));

beforeEach(() => {
  pathname = '/app/';
});

afterEach(() => {
  push.mockClear();
});

const nav = () => within(screen.getByRole('navigation', { name: 'App' }));

describe('AppShell', () => {
  it('has a sidebar with the business switcher, search and the app navigation: home, every ready tool, the business', () => {
    render(<AppShell>page</AppShell>);
    const sidebar = within(screen.getByRole('complementary', { name: 'SoloKit app' }));
    expect(sidebar.getByText('Business switcher')).toBeInTheDocument();
    expect(sidebar.getByRole('button', { name: /Search tools/ })).toBeInTheDocument();
    expect(nav().getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Home', '/app/'],
      ['Invoices', '/app/invoice/'],
      ['Agreements', '/app/contract/'],
      ['Your business', '/app/business/'],
    ]);
    expect(screen.getByText('page')).toBeInTheDocument();
  });

  it('lists the tools coming soon, without links', () => {
    render(<AppShell>page</AppShell>);
    const sidebar = within(screen.getByRole('complementary', { name: 'SoloKit app' }));
    expect(sidebar.getByText('Coming soon')).toBeInTheDocument();
    expect(sidebar.getByText('Time tracker')).toBeInTheDocument();
    expect(sidebar.queryByRole('link', { name: /Time tracker/ })).not.toBeInTheDocument();
  });

  it('marks the page shown, also deeper in a section and without a trailing slash', () => {
    pathname = '/app/invoice';
    const { unmount } = render(<AppShell>page</AppShell>);
    expect(nav().getByRole('link', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
    expect(nav().getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    unmount();
    pathname = '/app/setup/';
    render(<AppShell>page</AppShell>);
    expect(nav().getByRole('link', { name: 'Your business' })).toHaveAttribute('aria-current', 'page');
  });

  it('logo goes to the app home, and the sidebar foot back to the website', () => {
    render(<AppShell>page</AppShell>);
    for (const logo of screen.getAllByRole('link', { name: 'SoloKit home' })) expect(logo).toHaveAttribute('href', '/app/');
    const site = within(screen.getByRole('navigation', { name: 'SoloKit site' }));
    expect(site.getByRole('link', { name: 'SoloKit website' })).toHaveAttribute('href', '/');
    expect(site.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy/');
    expect(screen.getByText('Saved on this device only')).toBeInTheDocument();
  });

  it('opens the sidebar as a drawer from the Menu button, and Escape closes it, giving focus back', async () => {
    render(<AppShell>page</AppShell>);
    const menu = screen.getByRole('button', { name: 'Menu' });
    const sidebar = screen.getByRole('complementary', { name: 'SoloKit app' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(sidebar).not.toHaveAttribute('data-open');
    await userEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(sidebar).toHaveAttribute('data-open');
    expect(sidebar).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard('{Escape}');
    expect(sidebar).not.toHaveAttribute('data-open');
    expect(menu).toHaveFocus();
  });

  it('Search focuses the search on the app home, and Ctrl+K does too', async () => {
    render(
      <AppShell>
        <input id="app-search" aria-label="home search" />
      </AppShell>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Search tools/ }));
    expect(screen.getByRole('textbox', { name: 'home search' })).toHaveFocus();
    screen.getByRole('button', { name: 'Menu' }).focus();
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('textbox', { name: 'home search' })).toHaveFocus();
  });

  it('Search on another page goes to the app home to search', async () => {
    pathname = '/app/invoice/';
    render(<AppShell>page</AppShell>);
    await userEvent.click(screen.getByRole('button', { name: /Search tools/ }));
    expect(push).toHaveBeenCalledWith('/app/#search');
  });
});

function DirtyEditor({ dirty }: { dirty: boolean }) {
  useUnsavedGuard('editor', dirty, async () => true);
  return null;
}

describe('AppLink', () => {
  it('moves within the app without reloading', async () => {
    render(<AppLink href="/app/contract/">Agreements</AppLink>);
    await userEvent.click(screen.getByRole('link', { name: 'Agreements' }));
    expect(push).toHaveBeenCalledWith('/app/contract/');
  });

  it('asks before leaving unsaved work, and Stay keeps the page', async () => {
    render(
      <UnsavedGuardProvider>
        <DirtyEditor dirty />
        <AppLink href="/app/contract/">Agreements</AppLink>
      </UnsavedGuardProvider>,
    );
    await userEvent.click(screen.getByRole('link', { name: 'Agreements' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Leave this page?' });
    expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Save draft and leave', 'Leave without saving', 'Stay']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(push).not.toHaveBeenCalled();
  });

  it('leaves when the person chooses to', async () => {
    render(
      <UnsavedGuardProvider>
        <DirtyEditor dirty />
        <AppLink href="/app/contract/">Agreements</AppLink>
      </UnsavedGuardProvider>,
    );
    await userEvent.click(screen.getByRole('link', { name: 'Agreements' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Leave without saving' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/app/contract/'));
  });

  it('leaves a click with a modifier key to the browser, for a new tab', async () => {
    render(<AppLink href="/app/contract/">Agreements</AppLink>);
    const user = userEvent.setup();
    await user.keyboard('{Control>}');
    await user.click(screen.getByRole('link', { name: 'Agreements' }));
    await user.keyboard('{/Control}');
    expect(push).not.toHaveBeenCalled();
  });
});
