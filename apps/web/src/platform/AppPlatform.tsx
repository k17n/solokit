'use client';

import { useState, type ReactNode } from 'react';
import { createPlatform, getPlatform } from '@solokit/platform';
import { SHOW_UPSELL } from '../site';
import { PlatformProvider, type SlotComponent, type WebPlatform, type WebPlugin } from './PlatformProvider';
import { plugin as bundledPlugin } from './plugin';

export interface AppPlatformProps {
  children: ReactNode;
  /** Tests pass a plugin; the app passes nothing and uses the bundled one (none in this repo). */
  plugin?: WebPlugin | undefined;
  showUpsell?: boolean;
}

/**
 * Composes the platform once, at the app root, and provides it. A plugin comes from the bundled `./plugin` module or,
 * when the host loaded one at runtime, from `registerPlatform`. With neither this is the free platform and nothing changes.
 */
export function AppPlatform({ children, plugin = bundledPlugin, showUpsell = SHOW_UPSELL }: AppPlatformProps) {
  const [platform] = useState<WebPlatform>(() => (plugin ? createPlatform(plugin) : getPlatform<SlotComponent<never>>()));
  return (
    <PlatformProvider platform={platform} showUpsell={showUpsell}>
      {children}
    </PlatformProvider>
  );
}
