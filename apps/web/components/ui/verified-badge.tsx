import type { SVGProps } from 'react';

// Scalloped "seal" outline: a circle whose radius ripples 12 times around
// the edge. Computed once at module load, so server and client render the
// exact same path.
const LOBES = 12;
const STEPS = 96;
const SEAL_PATH =
  Array.from({ length: STEPS }, (_, i) => {
    const angle = (i / STEPS) * Math.PI * 2;
    const radius = 10.6 + 0.6 * Math.cos(LOBES * angle);
    const x = (12 + radius * Math.cos(angle)).toFixed(2);
    const y = (12 + radius * Math.sin(angle)).toFixed(2);
    return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join('') + 'Z';

/** The single "verified" mark used everywhere a profile is ID-verified. */
export function VerifiedBadge({ title = 'Verified', ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={title} {...props}>
      <path d={SEAL_PATH} fill="#1D9BF0" />
      <path
        d="M7.4 12.3l3.1 3.1 6.1-6.4"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
