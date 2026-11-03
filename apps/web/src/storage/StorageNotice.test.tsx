import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageNotice } from './StorageNotice';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/app/' }));

function stubStorage(storage: unknown) {
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });
}

beforeEach(() => {
  // This test environment's localStorage is not a working one, so use a plain in-memory stand-in.
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error remove the stub between tests
  delete navigator.storage;
});

describe('StorageNotice', () => {
  it('stays quiet when the browser keeps the data', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persist, persisted: vi.fn().mockResolvedValue(false) });
    render(<StorageNotice />);
    await waitFor(() => expect(persist).toHaveBeenCalled());
    expect(screen.queryByText(/may clear saved data/)).not.toBeInTheDocument();
  });

  it('does not ask again when the data is already kept', async () => {
    const persist = vi.fn();
    const persisted = vi.fn().mockResolvedValue(true);
    stubStorage({ persist, persisted });
    render(<StorageNotice />);
    await waitFor(() => expect(persisted).toHaveBeenCalled());
    expect(persist).not.toHaveBeenCalled();
    expect(screen.queryByText(/may clear saved data/)).not.toBeInTheDocument();
  });

  it('says so, and points to the backup, when the browser declines', async () => {
    stubStorage({ persist: vi.fn().mockResolvedValue(false), persisted: vi.fn().mockResolvedValue(false) });
    render(<StorageNotice />);
    expect(await screen.findByText('Your browser may clear saved data')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to backup' })).toHaveAttribute('href', '/app/business/#backup');
  });

  it('stays dismissed once dismissed', async () => {
    stubStorage({ persist: vi.fn().mockResolvedValue(false) });
    const { unmount } = render(<StorageNotice />);
    await userEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/may clear saved data/)).not.toBeInTheDocument();
    unmount();
    const persist = vi.fn().mockResolvedValue(false);
    stubStorage({ persist });
    render(<StorageNotice />);
    await waitFor(() => expect(persist).toHaveBeenCalled());
    expect(screen.queryByText(/may clear saved data/)).not.toBeInTheDocument();
  });

  it('says nothing in browsers that cannot be asked, or when asking fails', async () => {
    render(<StorageNotice />);
    expect(screen.queryByText(/may clear saved data/)).not.toBeInTheDocument();
    stubStorage({ persist: vi.fn().mockRejectedValue(new Error('nope')) });
    render(<StorageNotice />);
    // A rejected request counts as "not kept", so the notice shows rather than failing silently.
    expect(await screen.findByText('Your browser may clear saved data')).toBeInTheDocument();
  });
});
