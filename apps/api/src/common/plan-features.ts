import type { PlanFeature } from '@nadar-kalyanam/schemas';

// Plan display copy, from the entitlements JSON ({ features: [...] }).
// Anything malformed is dropped rather than shown.
export function planFeatures(entitlements: unknown): PlanFeature[] {
  const features = (entitlements as { features?: unknown } | null)?.features;
  if (!Array.isArray(features)) return [];
  return features.filter(
    (f): f is PlanFeature =>
      typeof f === 'object' && f !== null && typeof f.key === 'string' && typeof f.label === 'string' && typeof f.available === 'boolean',
  );
}
