import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type DataStore } from '@solokit/storage';
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
