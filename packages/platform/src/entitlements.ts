import { FEATURES, type FeatureId } from './features';

/** What this user may use. The plugin supplies a real one; the public app falls back to {@link freeEntitlements}. */
export interface Entitlements {
  /** True when the feature is available. Unknown features are false. Free features are always true. */
  has(feature: FeatureId): boolean;
  /** Calls the listener whenever the answer to any `has` may have changed. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

const FREE_IDS: ReadonlySet<string> = new Set(FEATURES.filter((feature) => feature.tier === 'free').map((feature) => feature.id));

/** The default: free features on, every paid feature off. Never changes, so `subscribe` does nothing. */
export const freeEntitlements: Entitlements = {
  has: (feature) => FREE_IDS.has(feature),
  subscribe: () => () => {},
};

/**
 * Entitlements for a fixed list of granted paid features, plus the free ones. Handy for a plugin that has already
 * fetched the list from its server. The check is a convenience for the interface; the server is the real gate.
 */
export function createStaticEntitlements(granted: Iterable<FeatureId>): Entitlements {
  const all = new Set<string>([...FREE_IDS, ...granted]);
  return { has: (feature) => all.has(feature), subscribe: () => () => {} };
}
