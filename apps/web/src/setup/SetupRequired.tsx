'use client';

import { useEffect } from 'react';
import { setupHref } from './links';
import { navigate } from './navigate';

/**
 * Shown by a tool whose Business is not set up yet: it sends the person to the setup page, which brings them back
 * here when it is done. Replaces this page in the history, so Back from setup does not bounce here again.
 */
export function SetupRequired({ returnTo }: { returnTo: string }) {
  const href = setupHref(returnTo);
  useEffect(() => {
    navigate(href, { replace: true });
  }, [href]);
  return (
    <p>
      Set up your business first. Taking you there now. <a href={href}>Go to setup</a>
    </p>
  );
}
