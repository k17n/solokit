'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
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
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The site works without the service worker; offline support is a bonus.
    });
  }, []);

  return null;
}
