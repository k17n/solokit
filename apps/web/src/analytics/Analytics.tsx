'use client';

import { useEffect } from 'react';
import { BEACON_SRC, beaconConfig, shouldLoadBeacon } from './beacon';

interface AnalyticsProps {
  /** Overrides the build-time token; for tests. */
  token?: string;
}

/**
 * Adds the Cloudflare Web Analytics beacon, once, when this is a production build with a token and the visitor has not
 * sent Do Not Track or Global Privacy Control. It reads nothing from the page. If the script cannot load (offline,
 * blocked) nothing happens and nothing is reported.
 */
export function Analytics({ token = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN }: AnalyticsProps) {
  useEffect(() => {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    const allowed = shouldLoadBeacon({
      nodeEnv: process.env.NODE_ENV,
      token,
      doNotTrack: nav.doNotTrack,
      globalPrivacyControl: nav.globalPrivacyControl,
    });
    if (!allowed || !token) return;
    if (document.querySelector('script[data-cf-beacon]')) return;
    const script = document.createElement('script');
    script.defer = true;
    script.src = BEACON_SRC;
    script.setAttribute('data-cf-beacon', beaconConfig(token));
    script.onerror = () => script.remove();
    document.body.appendChild(script);
  }, [token]);

  return null;
}
