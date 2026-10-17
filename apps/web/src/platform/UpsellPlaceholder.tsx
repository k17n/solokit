'use client';

import { getFeature, type FeatureId } from '@solokit/platform';

/** The honest placeholder: it names the features and says plainly they are not on sale yet. Nothing here links anywhere or collects anything. */
export function UpsellPlaceholder({ features }: { features: readonly FeatureId[] }) {
  const labels = features.map((id) => getFeature(id)?.label).filter((label): label is string => Boolean(label));
  if (labels.length === 0) return null;
  return (
    <p data-upsell="" style={{ color: 'var(--text-muted)', margin: 0 }}>
      Available in a paid plan (coming soon): {labels.join(', ')}.
    </p>
  );
}
