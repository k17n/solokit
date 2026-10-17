'use client';

import { createContext, useContext, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { createPlatform, type FeatureId, type Platform, type PlatformPlugin, type SlotContexts, type SlotName } from '@solokit/platform';

/** A plugin component for a slot. It receives the slot's context and renders whatever it likes. */
export type SlotComponent<N extends SlotName = SlotName> = ComponentType<SlotContexts[N]>;
export type WebPlatform = Platform<SlotComponent<never>>;
export type WebPlugin = PlatformPlugin<SlotComponent<never>>;

interface PlatformState {
  platform: WebPlatform;
  /** Shows an honest "available in a paid plan (coming soon)" placeholder where a locked slot would be. Off by default. */
  showUpsell: boolean;
}

// Outside a provider (most tests, and any page rendered without the root) the free platform applies.
const free: PlatformState = { platform: createPlatform<SlotComponent<never>>(), showUpsell: false };
const PlatformContext = createContext<PlatformState>(free);

export interface PlatformProviderProps {
  platform: WebPlatform;
  showUpsell?: boolean;
  children: ReactNode;
}

export function PlatformProvider({ platform, showUpsell = false, children }: PlatformProviderProps) {
  return <PlatformContext.Provider value={{ platform, showUpsell }}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): WebPlatform {
  return useContext(PlatformContext).platform;
}

export function useShowUpsell(): boolean {
  return useContext(PlatformContext).showUpsell;
}

/** True when the feature is on for this user. Re-renders when the entitlements change. The server, not this check, is the real gate. */
export function useEntitlement(feature: FeatureId): boolean {
  const { entitlements } = usePlatform();
  return useSyncExternalStore(
    entitlements.subscribe,
    () => entitlements.has(feature),
    () => entitlements.has(feature),
  );
}
