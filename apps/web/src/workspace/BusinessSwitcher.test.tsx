import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeManager } from '../business/testWorkspaces';
import { useStore } from '../store/StoreProvider';
import { BusinessSwitcher } from './BusinessSwitcher';
import { WorkspacesProvider, WorkspaceStore, useWorkspaces, type WorkspacesState } from './WorkspaceProvider';

let latest: WorkspacesState;
let toolBuilds = 0;

function Tool() {
  const { ready } = useStore();
  const workspaces = useWorkspaces();
  latest = workspaces;
  return <p>{ready ? `tool in ${workspaces.current?.name}` : 'tool loading'}</p>;
}

/** Counts how often the tool is built, to show that a switch replaces it while the header stays. */
function Counting() {
  useStore();
  toolBuilds += 1;
  return null;
}

function setup() {
  const { manager } = makeManager();
  render(
    <WorkspacesProvider manager={manager}>
      <header>
        <BusinessSwitcher />
      </header>
      <WorkspaceStore>
        <Tool />
      </WorkspaceStore>
      <a href="#after">after the header</a>
    </WorkspacesProvider>,
  );
  return manager;
}

const trigger = () => screen.getByRole('button', { name: /^Business/ });

async function addSecond() {
  await screen.findByText('tool in My business');
  await act(async () => {
    await latest.create('Studio Two', { switchTo: false });
  });
}

describe('BusinessSwitcher', () => {
  it('shows nothing but a live region until the businesses are known, then the current name', async () => {
    setup();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Business My business' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens a list of plain buttons with the current business marked, plus add and manage links', async () => {
    setup();
    await addSecond();
    await userEvent.click(trigger());
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    const group = screen.getByRole('group', { name: 'Businesses' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['My businessCurrent', 'Studio Two']);
    expect(buttons[0]).toHaveAttribute('aria-current', 'true');
    expect(buttons[1]).not.toHaveAttribute('aria-current');
    expect(within(group).getByRole('link', { name: '+ Add a business' })).toHaveAttribute('href', '/app/business/#add');
    expect(within(group).getByRole('link', { name: 'Manage businesses' })).toHaveAttribute('href', '/app/business/#businesses');
  });

  it('focuses the current business on open, and the arrow keys, Home and End move through the items', async () => {
    setup();
    await addSecond();
    await userEvent.click(trigger());
    expect(screen.getByRole('button', { name: /^My business/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: 'Studio Two' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('link', { name: '+ Add a business' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('link', { name: 'Manage businesses' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('button', { name: /^My business/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('link', { name: 'Manage businesses' })).toHaveFocus();
  });

  it('closes with Escape and gives focus back to the button', async () => {
    setup();
    await screen.findByText('tool in My business');
    await userEvent.click(trigger());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Businesses' })).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes when focus leaves the menu, and when something else is clicked', async () => {
    setup();
    await screen.findByText('tool in My business');
    await userEvent.click(trigger());
    await userEvent.keyboard('{End}{Tab}');
    expect(screen.queryByRole('group', { name: 'Businesses' })).not.toBeInTheDocument();
    await userEvent.click(trigger());
    await userEvent.click(document.body);
    expect(screen.queryByRole('group', { name: 'Businesses' })).not.toBeInTheDocument();
  });

  it('switches business, replaces the tool, announces it politely and returns focus to the button', async () => {
    setup();
    await addSecond();
    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('');
    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole('button', { name: 'Studio Two' }));
    expect(await screen.findByText('tool in Studio Two')).toBeInTheDocument();
    await waitFor(() => expect(live).toHaveTextContent('Now working in Studio Two'));
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAccessibleName('Business Studio Two');
    expect(screen.queryByRole('group', { name: 'Businesses' })).not.toBeInTheDocument();
  });

  it('announces a change that came from elsewhere too, for example a business created and switched to', async () => {
    setup();
    await screen.findByText('tool in My business');
    await act(async () => {
      await latest.create('Brand new');
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Now working in Brand new'));
  });

  it('does not list archived businesses', async () => {
    setup();
    await screen.findByText('tool in My business');
    let second = latest.workspaces[0]!;
    await act(async () => {
      second = await latest.create('Old one', { switchTo: false });
    });
    await act(async () => latest.archive(second.id));
    await userEvent.click(trigger());
    expect(screen.queryByRole('button', { name: 'Old one' })).not.toBeInTheDocument();
  });
});

describe('WorkspacesProvider with a header above the tool', () => {
  it('reads and creates nothing until it is enabled, and keeps what it loaded afterwards', async () => {
    const { manager } = makeManager();
    const view = (enabled: boolean) => (
      <WorkspacesProvider manager={manager} enabled={enabled}>
        <BusinessSwitcher />
      </WorkspacesProvider>
    );
    const list = vi.spyOn(manager, 'list');
    const current = vi.spyOn(manager, 'current');
    const { rerender } = render(view(false));
    // Effects have run by now: a disabled provider asked for nothing.
    expect(list).not.toHaveBeenCalled();
    expect(current).not.toHaveBeenCalled();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(view(true));
    expect(await screen.findByRole('button', { name: 'Business My business' })).toBeInTheDocument();
    rerender(view(false));
    expect(screen.getByRole('button', { name: 'Business My business' })).toBeInTheDocument();
  });

  it('keeps the header mounted while the tool below is replaced', async () => {
    const { manager } = makeManager();
    toolBuilds = 0;
    render(
      <WorkspacesProvider manager={manager}>
        <BusinessSwitcher />
        <WorkspaceStore>
          <Counting />
          <Tool />
        </WorkspaceStore>
      </WorkspacesProvider>,
    );
    await screen.findByText('tool in My business');
    const before = toolBuilds;
    const button = trigger();
    await act(async () => {
      await latest.create('Another');
    });
    await screen.findByText('tool in Another');
    expect(toolBuilds).toBeGreaterThan(before);
    expect(trigger()).toBe(button);
  });
});
