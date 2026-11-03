import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceWorkerRegister } from './ServiceWorkerRegister';

function stubServiceWorker() {
  const register = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true });
  return register;
}

afterEach(() => {
  vi.unstubAllEnvs();
  // @ts-expect-error remove the stub between tests
  delete navigator.serviceWorker;
});

describe('ServiceWorkerRegister', () => {
  it('registers the service worker in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const register = stubServiceWorker();
    render(<ServiceWorkerRegister />);
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('stays out of the way during development and tests', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const register = stubServiceWorker();
    render(<ServiceWorkerRegister />);
    expect(register).not.toHaveBeenCalled();
  });

  it('unregisters leftover workers in development and never registers', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const unregister = vi.fn().mockResolvedValue(true);
    const register = vi.fn();
    const getRegistrations = vi.fn().mockResolvedValue([{ unregister }, { unregister }]);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register, getRegistrations },
      configurable: true,
    });
    render(<ServiceWorkerRegister />);
    await vi.waitFor(() => expect(unregister).toHaveBeenCalledTimes(2));
    expect(register).not.toHaveBeenCalled();
  });

  it('tolerates a missing or rejecting getRegistrations in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    stubServiceWorker();
    expect(() => render(<ServiceWorkerRegister />)).not.toThrow();
    const getRegistrations = vi.fn().mockRejectedValue(new Error('nope'));
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register: vi.fn(), getRegistrations },
      configurable: true,
    });
    expect(() => render(<ServiceWorkerRegister />)).not.toThrow();
    await vi.waitFor(() => expect(getRegistrations).toHaveBeenCalled());
  });

  it('does nothing in browsers without service worker support', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => render(<ServiceWorkerRegister />)).not.toThrow();
  });

  it('shows a reload banner when a new version takes over an open window, and hides it on Later', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    let takeOver = () => {};
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: {},
        register: vi.fn().mockResolvedValue({ update: vi.fn() }),
        addEventListener: (_type: string, fn: () => void) => {
          takeOver = fn;
        },
        removeEventListener: vi.fn(),
      },
      configurable: true,
    });
    render(<ServiceWorkerRegister />);
    expect(screen.queryByText(/new version of SoloKit/)).not.toBeInTheDocument();
    await vi.waitFor(() => expect(takeOver).not.toBe(undefined));
    await act(async () => takeOver());
    expect(await screen.findByText(/new version of SoloKit is ready/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByText(/new version of SoloKit/)).not.toBeInTheDocument();
  });
});
