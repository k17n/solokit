import { useEffect } from 'react';

/**
 * While `active`, asks the browser to confirm before the page is closed, reloaded or navigated away from.
 * (The browser shows its own wording; a page cannot change it.)
 */
export function useUnloadGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need a value here.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
}
