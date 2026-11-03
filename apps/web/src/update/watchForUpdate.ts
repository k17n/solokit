/** How often an open window asks the server whether there is a newer version. */
export const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Calls `onUpdate` when a newer service worker takes over a window that was already running under an older one.
 * The worker skips waiting, so this is the moment the window is still running the old page code. The very first
 * install is not an update: the window had no worker to replace. Also asks the server for a newer worker whenever
 * the window comes back into view and every hour, because an installed app window can stay open for days without
 * ever loading a page. Returns a function that stops it. Never throws.
 */
export function watchForUpdate(
  container: Pick<ServiceWorkerContainer, 'controller' | 'addEventListener' | 'removeEventListener'>,
  registration: Pick<ServiceWorkerRegistration, 'update'> | undefined,
  onUpdate: () => void,
): () => void {
  const hadController = Boolean(container.controller);
  const onChange = () => {
    if (hadController) onUpdate();
  };
  container.addEventListener('controllerchange', onChange);

  const check = () => {
    try {
      void Promise.resolve(registration?.update()).catch(() => {});
    } catch {
      // A failed check is not worth bothering anyone about; the next one tries again.
    }
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') check();
  };
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(check, UPDATE_CHECK_MS);

  return () => {
    container.removeEventListener('controllerchange', onChange);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
  };
}
