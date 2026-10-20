'use client';

import { Lock } from 'lucide-react';
import type { LockedFeature } from '../../lib/membership';
import { ComingSoonPill } from '../ui/coming-soon-note';

// One option the member's plan doesn't include: greyed out with a lock and
// the plan that adds it. `dense` is the home sidebar size.
export function LockedFeatureLine({ feature, dense = false }: { feature: LockedFeature; dense?: boolean }) {
  return (
    <li
      className={`flex items-start gap-2.5 ${dense ? 'text-xs' : 'text-xs sm:text-sm'} text-nk-subtle`}
      data-testid="locked-feature"
      data-feature={feature.key}
      data-unlock-plan={feature.planCode}
    >
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#F4F0EA] text-[#A88C78]">
        <Lock className="h-2.5 w-2.5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span>{feature.label}</span>
        <span className="ml-1.5 inline-block align-middle text-[10px] font-semibold uppercase tracking-wide text-nk-gold-text">
          {feature.planName}
        </span>
        {feature.comingSoon && (
          <span className="ml-1.5 inline-block align-middle">
            <ComingSoonPill />
          </span>
        )}
        <span className="sr-only"> (not included in your plan)</span>
      </span>
    </li>
  );
}

export function LockedFeatureList({ features, dense = false, className = '' }: { features: LockedFeature[]; dense?: boolean; className?: string }) {
  return (
    <ul className={`space-y-2 ${className}`} data-testid="locked-features">
      {features.map((f) => (
        <LockedFeatureLine key={f.key} feature={f} dense={dense} />
      ))}
    </ul>
  );
}
