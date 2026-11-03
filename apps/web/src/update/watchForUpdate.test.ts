import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UPDATE_CHECK_MS, watchForUpdate } from './watchForUpdate';

/** A service worker container that can be told when a new worker takes over. */
function fakeContainer(controller: unknown) {
  const listeners = new Set<() => void>();
  return {
    controller,
    addEventListener: vi.fn((_type: string, fn: () => void) => listeners.add(fn)),
    removeEventListener: vi.fn((_type: string, fn: () => void) => listeners.delete(fn)),
    takeOver: () => listeners.forEach((fn) => fn()),
    count: () => listeners.size,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('watchForUpdate', () => {
  it('reports an update when a new worker takes over a window that already had one', () => {
    const container = fakeContainer({});
    const onUpdate = vi.fn();
    watchForUpdate(container as never, undefined, onUpdate);
    container.takeOver();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('does not report the first install, when there was no worker to replace', () => {
    const container = fakeContainer(null);
    const onUpdate = vi.fn();
    watchForUpdate(container as never, undefined, onUpdate);
    container.takeOver();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('asks the server for a newer worker when the window becomes visible, not when it is hidden', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    watchForUpdate(fakeContainer({}) as never, { update }, vi.fn());
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(1);
    visibility.mockRestore();
  });

  it('checks again every hour', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    watchForUpdate(fakeContainer({}) as never, { update }, vi.fn());
    vi.advanceTimersByTime(UPDATE_CHECK_MS * 2);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('survives a failed check, whether it rejects or throws', () => {
    const rejecting = { update: vi.fn().mockRejectedValue(new Error('offline')) };
    watchForUpdate(fakeContainer({}) as never, rejecting, vi.fn());
    const throwing = {
      update: vi.fn(() => {
        throw new Error('invalid state');
      }),
    };
    watchForUpdate(fakeContainer({}) as never, throwing, vi.fn());
    expect(() => vi.advanceTimersByTime(UPDATE_CHECK_MS)).not.toThrow();
  });

  it('stops listening and checking once stopped', () => {
    const container = fakeContainer({});
    const update = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn();
    const stop = watchForUpdate(container as never, { update }, onUpdate);
    stop();
    container.takeOver();
    vi.advanceTimersByTime(UPDATE_CHECK_MS * 2);
    expect(container.count()).toBe(0);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
