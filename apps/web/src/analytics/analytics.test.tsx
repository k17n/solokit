import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Analytics } from './Analytics';
import { BEACON_SRC, beaconConfig, isValidToken, shouldLoadBeacon, type Environment } from './beacon';

const TOKEN = '0123456789abcdef0123456789abcdef';
const prod: Environment = { nodeEnv: 'production', token: TOKEN, doNotTrack: null, globalPrivacyControl: undefined };

afterEach(() => {
  document.querySelectorAll('script[data-cf-beacon]').forEach((s) => s.remove());
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('beacon rules', () => {
  it('loads in a production build with a token and no privacy signal', () => {
    expect(shouldLoadBeacon(prod)).toBe(true);
  });

  it('never loads outside production (dev and tests)', () => {
    expect(shouldLoadBeacon({ ...prod, nodeEnv: 'development' })).toBe(false);
    expect(shouldLoadBeacon({ ...prod, nodeEnv: 'test' })).toBe(false);
  });

  it('never loads without a usable token', () => {
    for (const token of [undefined, '', '   ', 'has space', '"},"x":"', '<script>']) {
      expect(shouldLoadBeacon({ ...prod, token })).toBe(false);
    }
  });

  it('respects Do Not Track and Global Privacy Control', () => {
    expect(shouldLoadBeacon({ ...prod, doNotTrack: '1' })).toBe(false);
    expect(shouldLoadBeacon({ ...prod, doNotTrack: 'yes' })).toBe(false);
    expect(shouldLoadBeacon({ ...prod, doNotTrack: '0' })).toBe(true);
    expect(shouldLoadBeacon({ ...prod, globalPrivacyControl: true })).toBe(false);
    expect(shouldLoadBeacon({ ...prod, globalPrivacyControl: false })).toBe(true);
  });

  it('accepts only plain alphanumeric tokens', () => {
    expect(isValidToken(TOKEN)).toBe(true);
    expect(isValidToken('short')).toBe(false);
  });

  it('configures only the token (no custom data, no single-page mode)', () => {
    expect(JSON.parse(beaconConfig(TOKEN))).toEqual({ token: TOKEN });
  });

  it('points at the Cloudflare beacon', () => {
    expect(BEACON_SRC).toBe('https://static.cloudflareinsights.com/beacon.min.js');
  });
});

describe('Analytics component', () => {
  it('renders nothing visible and adds no script in tests', () => {
    vi.stubEnv('NEXT_PUBLIC_CF_ANALYTICS_TOKEN', TOKEN);
    const { container } = render(<Analytics />);
    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector('script[data-cf-beacon]')).toBeNull();
  });

  it('injects one deferred beacon script in production with a token', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { rerender } = render(<Analytics token={TOKEN} />);
    const script = document.querySelector('script[data-cf-beacon]') as HTMLScriptElement;
    expect(script.src).toBe(BEACON_SRC);
    expect(script.defer).toBe(true);
    expect(JSON.parse(script.getAttribute('data-cf-beacon')!)).toEqual({ token: TOKEN });
    rerender(<Analytics token={TOKEN} />);
    expect(document.querySelectorAll('script[data-cf-beacon]')).toHaveLength(1);
  });

  it('adds nothing without a token', () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(<Analytics token="" />);
    expect(document.querySelector('script[data-cf-beacon]')).toBeNull();
  });

  it('adds nothing when the browser sends Do Not Track or Global Privacy Control', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubGlobal('navigator', { ...navigator, doNotTrack: '1' });
    render(<Analytics token={TOKEN} />);
    expect(document.querySelector('script[data-cf-beacon]')).toBeNull();
    vi.stubGlobal('navigator', { doNotTrack: null, globalPrivacyControl: true });
    render(<Analytics token={TOKEN} />);
    expect(document.querySelector('script[data-cf-beacon]')).toBeNull();
  });
});
