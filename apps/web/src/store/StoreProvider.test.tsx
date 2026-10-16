import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StorageBlockedError, StorageError, StorageVersionError, createMemoryStore, type DataStore } from '@solokit/storage';
import { StoreProvider, useStore } from './StoreProvider';

afterEach(() => vi.restoreAllMocks());

function Probe() {
  const { store, persistent, ready } = useStore();
  return (
    <p>
      {ready ? 'ready' : 'loading'} / {store ? 'store' : 'no store'} / {persistent ? 'persistent' : 'temporary'}
    </p>
  );
}

const UPDATED = 'SoloKit was updated. Reload this page to keep saving.';

/** A store that works until `breakIt` is called, after which every request fails the way a database upgraded by a newer SoloKit does. */
function upgradableStore(error: Error) {
  const inner = createMemoryStore();
  let broken = false;
  const guard = <A extends unknown[], R>(call: (...args: A) => Promise<R>) => (...args: A) => (broken ? Promise.reject(error) : call(...args));
  const store = { get: guard(inner.get.bind(inner)), put: guard(inner.put.bind(inner)), list: guard(inner.list.bind(inner)), remove: guard(inner.remove.bind(inner)), exportAll: guard(inner.exportAll.bind(inner)), importAll: guard(inner.importAll.bind(inner)) } as DataStore;
  return { store, breakIt: () => void (broken = true) };
}

function Saver() {
  const { store } = useStore();
  return (
    <button type="button" onClick={() => void store?.put('settings', { id: 'x' } as never).catch(() => {})}>
      save something
    </button>
  );
}

describe('StoreProvider when SoloKit has been updated', () => {
  it('asks for a reload, with a Reload button, once a save fails because the database was upgraded', async () => {
    const { store, breakIt } = upgradableStore(new StorageVersionError());
    const reload = vi.fn();
    render(
      <StoreProvider factory={() => store} reload={reload}>
        <Saver />
      </StoreProvider>,
    );
    const save = await screen.findByRole('button', { name: 'save something' });
    expect(screen.queryByText(UPDATED)).not.toBeInTheDocument();
    breakIt();
    await userEvent.click(save);
    expect(await screen.findByText(UPDATED)).toBeInTheDocument();
    // The tool stays on screen, so nothing the person typed disappears.
    expect(screen.getByRole('button', { name: 'save something' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('says the same when another tab is blocking the upgrade', async () => {
    const { store, breakIt } = upgradableStore(new StorageBlockedError());
    render(
      <StoreProvider factory={() => store} reload={() => {}}>
        <Saver />
      </StoreProvider>,
    );
    const save = await screen.findByRole('button', { name: 'save something' });
    breakIt();
    await userEvent.click(save);
    expect(await screen.findByText(UPDATED)).toBeInTheDocument();
  });

  it('shows only the reload message, not a temporary store, when the very first open is refused because of an update', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const refused = (): DataStore => ({ ...createMemoryStore(), list: () => Promise.reject(new StorageVersionError()) });
    const reload = vi.fn();
    render(
      <StoreProvider factory={refused} reload={reload}>
        <Probe />
      </StoreProvider>,
    );
    expect(await screen.findByText(UPDATED)).toBeInTheDocument();
    expect(screen.queryByText(/temporary/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalled();
  });

  it('also recognises a browser VersionError that was not wrapped', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const raw = Object.assign(new Error('The requested version (2) is less than the existing version (3).'), { name: 'VersionError' });
    const refused = (): DataStore => ({ ...createMemoryStore(), list: () => Promise.reject(raw) });
    render(
      <StoreProvider factory={refused}>
        <Probe />
      </StoreProvider>,
    );
    expect(await screen.findByText(UPDATED)).toBeInTheDocument();
  });

  it('does not show the message for an ordinary storage failure', async () => {
    const { store, breakIt } = upgradableStore(new StorageError('quota exceeded'));
    render(
      <StoreProvider factory={() => store}>
        <Saver />
      </StoreProvider>,
    );
    const save = await screen.findByRole('button', { name: 'save something' });
    breakIt();
    await userEvent.click(save);
    expect(screen.queryByText(UPDATED)).not.toBeInTheDocument();
  });
});

describe('StoreProvider', () => {
  it('is not ready before the store has been probed', () => {
    render(
      <StoreProvider factory={createMemoryStore}>
        <Probe />
      </StoreProvider>,
    );
    expect(screen.getByText('loading / no store / temporary')).toBeInTheDocument();
  });

  it('provides a persistent store once it works', async () => {
    render(
      <StoreProvider factory={createMemoryStore}>
        <Probe />
      </StoreProvider>,
    );
    expect(await screen.findByText('ready / store / persistent')).toBeInTheDocument();
  });

  it('falls back to a temporary store, and says so in the console, when creating the store throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = () => {
      throw new Error('IndexedDB blocked');
    };
    render(
      <StoreProvider factory={broken}>
        <Probe />
      </StoreProvider>,
    );
    expect(await screen.findByText('ready / store / temporary')).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
  });

  it('falls back to a temporary store when the first read fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing = (): DataStore => ({ ...createMemoryStore(), list: () => Promise.reject(new Error('quota')) });
    render(
      <StoreProvider factory={failing}>
        <Probe />
      </StoreProvider>,
    );
    expect(await screen.findByText('ready / store / temporary')).toBeInTheDocument();
  });

  it('creates the store only once even when the factory is an inline function that changes on every render', async () => {
    const created = vi.fn(() => createMemoryStore());
    function Parent() {
      const [count, setCount] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setCount(count + 1)}>
            rerender {count}
          </button>
          <StoreProvider factory={() => created()}>
            <Probe />
          </StoreProvider>
        </>
      );
    }
    render(<Parent />);
    expect(await screen.findByText('ready / store / persistent')).toBeInTheDocument();
    screen.getByRole('button').click();
    await screen.findByText('rerender 1');
    expect(created).toHaveBeenCalledTimes(1);
  });
});
