/**
 * Cloudflare Web Analytics: cookie-free visit counting. Only the page address, referrer, country, device and browser
 * type, and load timings are counted. Nothing from a tool screen (anything typed, any saved record) is ever read or
 * passed to the beacon, and no custom events exist. See docs/deploy-cloudflare-pages.md.
 *
 * The site navigates with real page loads, so the beacon's default page view per load is enough; single-page mode
 * (`spa`) is deliberately not enabled.
 */
export const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

export interface Environment {
  nodeEnv: string | undefined;
  token: string | undefined;
  /** navigator.doNotTrack, which is '1' (or 'yes' in older browsers) when the visitor asked not to be tracked. */
  doNotTrack: string | null | undefined;
  /** navigator.globalPrivacyControl, true when the visitor asked not to have their data sold or shared. */
  globalPrivacyControl: boolean | undefined;
}

/** Cloudflare site tokens are 32 hex characters; anything outside plain letters and digits is refused so it can never break out of the attribute. */
export function isValidToken(token: string | undefined): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9]{16,64}$/.test(token);
}

export function shouldLoadBeacon(env: Environment): boolean {
  if (env.nodeEnv !== 'production') return false;
  if (!isValidToken(env.token)) return false;
  if (env.doNotTrack === '1' || env.doNotTrack === 'yes') return false;
  if (env.globalPrivacyControl === true) return false;
  return true;
}

/** The value of the data-cf-beacon attribute: only the token. */
export function beaconConfig(token: string): string {
  return JSON.stringify({ token });
}
