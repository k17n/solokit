'use client';

import { useEffect, useState } from 'react';
import { UpdateBanner } from './update/UpdateBanner';
import { watchForUpdate } from './update/watchForUpdate';

export function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      // A leftover production worker (e.g. from `pnpm preview`) would control dev pages.
      navigator.serviceWorker
        .getRegistrations?.()
        ?.then((registrations) => registrations.forEach((r) => void r.unregister()))
        .catch(() => {});
      return;
    }
    let stop: (() => void) | undefined;
    let cancelled = false;
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (cancelled) return;
        stop = watchForUpdate(navigator.serviceWorker, registration, () => setUpdateReady(true));
      })
      .catch(() => {
        // The site works without the service worker; offline support is a bonus.
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return updateReady ? <UpdateBanner onReload={() => window.location.reload()} onLater={() => setUpdateReady(false)} /> : null;
}
