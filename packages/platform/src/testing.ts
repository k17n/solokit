import type { Entitlements } from './entitlements';
import { FEATURES, type FeatureId } from './features';

/** A test double: free features on, paid ones on only after `grant`. Notifies subscribers on change. */
export interface FakeEntitlements extends Entitlements {
  grant(...features: FeatureId[]): void;
  revoke(...features: FeatureId[]): void;
}

export function createFakeEntitlements(granted: readonly FeatureId[] = []): FakeEntitlements {
  const on = new Set<string>([...FEATURES.filter((f) => f.tier === 'free').map((f) => f.id), ...granted]);
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    has: (feature) => on.has(feature),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    grant(...features) {
      features.forEach((feature) => on.add(feature));
      notify();
    },
    revoke(...features) {
      features.forEach((feature) => on.delete(feature));
      notify();
    },
  };
}
