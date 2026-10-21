'use client';

import { useEffect } from 'react';

/**
 * Sends an old address on to where the page lives now, keeping its query and #section, so bookmarks and links from
 * before the app moved under /app/ keep working. Replaces the old address in the history.
 */
export function Forward({ to, label }: { to: string; label: string }) {
  useEffect(() => {
    window.location.replace(`${to}${window.location.search}${window.location.hash}`);
  }, [to]);
  return (
    <p>
      {label} has moved. Taking you there now. <a href={to}>Go to {label}</a>
    </p>
  );
}
