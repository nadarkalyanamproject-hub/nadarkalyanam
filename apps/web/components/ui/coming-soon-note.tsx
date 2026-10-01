import { Lock } from 'lucide-react';
import { COMING_SOON, type ComingSoonKey } from '../../lib/coming-soon';

// Visible but inert: the app's one style for a feature that has no data yet.
// No input, no state, nothing sent or loaded — just what's missing and why.
export function ComingSoonNote({ feature, testId = 'coming-soon' }: { feature: ComingSoonKey; testId?: string }) {
  const { label, reason } = COMING_SOON[feature];
  return (
    <div
      className="rounded-xl border border-dashed border-[#DECDBB] bg-[#FAF7F2] px-3.5 py-2.5 text-left"
      data-testid={testId}
      data-filter={feature}
      aria-disabled="true"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#73645C]">
          <Lock className="h-3.5 w-3.5 text-[#A88C78] shrink-0" aria-hidden="true" />
          {label}
        </span>
        <ComingSoonPill />
      </div>
      <p className="mt-1 text-[11px] sm:text-xs text-[#8C7B73]">{reason}</p>
    </div>
  );
}

export function ComingSoonPill() {
  return (
    <span className="shrink-0 rounded-full border border-[#E6D3B0] bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9C7328]">
      Coming soon
    </span>
  );
}
