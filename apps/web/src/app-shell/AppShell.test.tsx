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
  it('has the app navigation: home, every ready tool by its short name, and the business', () => {
    render(<AppShell>page</AppShell>);
    expect(nav().getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Home', '/app/'],
      ['Invoices', '/app/invoice/'],
      ['Agreements', '/app/contract/'],
      ['Your business', '/app/business/'],
    ]);
    expect(screen.getByText('page')).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByText('Business switcher')).toBeInTheDocument();
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

  it('logo goes to the app home, and the footer back to the site', () => {
    render(<AppShell>page</AppShell>);
    expect(screen.getByRole('link', { name: 'SoloKit home' })).toHaveAttribute('href', '/app/');
    const footer = within(screen.getByRole('navigation', { name: 'SoloKit site' }));
    expect(footer.getByRole('link', { name: 'SoloKit website' })).toHaveAttribute('href', '/');
    expect(footer.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy/');
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
