import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMemoryStore, type DataStore } from '@solokit/storage';
import { StoreProvider, useStore } from './StoreProvider';

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

  it('falls back to a temporary store when creating the store throws', async () => {
    const broken = () => {
      throw new Error('IndexedDB blocked');
    };
    render(
      <StoreProvider factory={broken}>
        <Probe />
      </StoreProvider>,
    );
    expect(await screen.findByText('ready / store / temporary')).toBeInTheDocument();
  });

  it('falls back to a temporary store when the first read fails', async () => {
    const failing = (): DataStore => ({
      ...createMemoryStore(),
      list: () => Promise.reject(new Error('quota')),
    });
    render(
      <StoreProvider factory={failing}>
        <Probe />
      </StoreProvider>,
    );
    expect(await screen.findByText('ready / store / temporary')).toBeInTheDocument();
  });
});
