'use client';

import { useSyncExternalStore } from 'react';
import { getSlot, type FeatureId, type SlotContexts, type SlotName } from '@solokit/platform';
import { usePlatform, useShowUpsell, type SlotComponent } from './PlatformProvider';
import { UpsellPlaceholder } from './UpsellPlaceholder';

/** The paid features this slot advertises that the user does not have. Re-renders when the entitlements change. */
export function useLockedFeatures(features: readonly FeatureId[]): FeatureId[] {
  const { entitlements } = usePlatform();
  const snapshot = () => features.filter((feature) => !entitlements.has(feature)).join(',');
  const locked = useSyncExternalStore(entitlements.subscribe, snapshot, snapshot);
  return locked ? (locked.split(',') as FeatureId[]) : [];
}

export type ProSlotProps<N extends SlotName> = { name: N } & (keyof SlotContexts[N] extends never ? { context?: SlotContexts[N] } : { context: SlotContexts[N] });

/**
 * A place where a plugin may add interface. With no plugin it renders nothing. If a plugin registered a component for
 * this slot, that component renders (the plugin decides what an unentitled user sees). Otherwise, only when the site
 * config turns upsell on, a plain "coming soon" placeholder stands in for the slot's paid features.
 */
export function ProSlot<N extends SlotName>({ name, context }: ProSlotProps<N>) {
  const { slots } = usePlatform();
  const showUpsell = useShowUpsell();
  const locked = useLockedFeatures(getSlot(name)?.upsellFeatures ?? []);
  const Registered = slots[name] as SlotComponent<N> | undefined;
  if (Registered) return <Registered {...((context ?? {}) as SlotContexts[N])} />;
  if (showUpsell && locked.length > 0) return <UpsellPlaceholder features={locked} />;
  return null;
}
