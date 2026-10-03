'use client';

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

// Inline-SVG charts for the admin dashboard — no chart library. Colors come
// from a validated categorical palette (adjacent-pair colorblind-safe on a
// white surface); every value is also readable as text (legend counts,
// end labels, table view), so color never carries meaning alone.
export const CHART_COLORS = { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a', yellow: '#eda100' } as const;
const INK = { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7', surface: '#ffffff' };

// ---------------------------------------------------------------- Donut ----

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

// Part-to-whole ring with a 2px surface gap between slices. Zero-value
// segments draw nothing but stay in the legend with their real count.
export function DonutChart({ segments, centerLabel }: { segments: DonutSegment[]; centerLabel: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const size = 120;
  const r = 46;
  const stroke = 16;
  const c = 2 * Math.PI * r;
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? 2 : 0;
  // Each slice starts where the previous ones end.
  const arcs = visible.map((s, i) => ({
    segment: s,
    length: (s.value / total) * c,
    start: visible.slice(0, i).reduce((sum, prev) => sum + (prev.value / total) * c, 0),
  }));
  const [hover, setHover] = useState<string | null>(null);
  const hovered = segments.find((s) => s.label === hover);

  return (
    // The legend sits beside the ring when there's room and wraps below it in
    // a narrow card, so counts never get squeezed off the edge.
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-28 w-28 shrink-0" role="img" aria-label={`${centerLabel}: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
        {total === 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={INK.grid} strokeWidth={stroke} />}
        {arcs.map(({ segment: s, length, start }) => {
          const dash = Math.max(length - gap, 0.5);
          return (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={hover === s.label ? stroke + 3 : stroke}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-start}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              onPointerEnter={() => setHover(s.label)}
              onPointerLeave={() => setHover(null)}
              style={{ cursor: 'default', transition: 'stroke-width 120ms' }}
            >
              <title>{`${s.label}: ${s.value.toLocaleString('en-IN')}`}</title>
            </circle>
          );
        })}
        <text x="50%" y="48%" textAnchor="middle" fontSize="20" fontWeight="700" fill={INK.primary}>
          {(hovered ? hovered.value : total).toLocaleString('en-IN')}
        </text>
        <text x="50%" y="63%" textAnchor="middle" fontSize="9" fill={INK.secondary}>
          {hovered ? hovered.label : centerLabel}
        </text>
      </svg>
      <ul className="flex min-w-[11rem] flex-1 flex-col gap-1.5 text-sm" data-testid="status-legend">
        {segments.map((s) => (
          <li
            key={s.label}
            className="flex items-center justify-between gap-3"
            onPointerEnter={() => setHover(s.label)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </span>
            <span className="font-semibold tabular-nums text-foreground" data-status-count={s.label}>
              {s.value.toLocaleString('en-IN')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ----------------------------------------------------------- Line chart ----

export interface LinePoint {
  date: string; // YYYY-MM-DD
  value: number;
}

function niceMax(max: number): number {
  if (max <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= max) return m * step;
  return 10 * step;
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

// One series, one y-axis (from 0), hairline grid, 2px line, end marker with a
// surface ring and an end-value label. A crosshair snaps to the nearest day
// on hover/focus (arrow keys move it) and shows that day's value.
export function LineChart({ title, points, color, testId }: { title: string; points: LinePoint[]; color: string; testId?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry!.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const height = 180;
  const pad = { top: 16, right: 44, bottom: 26, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const x = (i: number) => pad.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points.length - 1;
  const labelIdx = points.length > 2 ? [0, Math.floor(last / 2), last] : points.map((_, i) => i);

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - pad.left) / innerW) * last);
    setActive(Math.min(last, Math.max(0, i)));
  }
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowRight') setActive((a) => Math.min(last, (a ?? last) + 1));
    else if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? last) - 1));
  }
  const tip = active !== null ? points[active] : null;

  return (
    <figure className="relative" data-testid={testId}>
      <figcaption className="mb-1 text-xs font-semibold text-muted-foreground">{title}</figcaption>
      <div ref={wrapRef} className="relative w-full">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title}: ${points.length} days, latest ${points.at(-1)?.value ?? 0}`}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(last)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.axis : INK.grid} strokeWidth={1} />
              <text x={pad.left - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill={INK.muted}>
                {Math.round(t).toLocaleString('en-IN')}
              </text>
            </g>
          ))}
          {labelIdx.map((i) => (
            <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} fontSize="10" fill={INK.muted}>
              {shortDate(points[i]!.date)}
            </text>
          ))}
          {points.length > 0 && <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {active !== null && (
            <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + innerH} stroke={INK.muted} strokeWidth={1} />
          )}
          {points.length > 0 && (
            <>
              <circle cx={x(active ?? last)} cy={y(points[active ?? last]!.value)} r={5} fill={color} stroke={INK.surface} strokeWidth={2} />
              <text x={x(last) + 8} y={y(points[last]!.value) + 4} fontSize="11" fontWeight="600" fill={INK.primary}>
                {points[last]!.value.toLocaleString('en-IN')}
              </text>
            </>
          )}
        </svg>
        {tip && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs shadow-sm"
            style={{ left: Math.min(Math.max((x(active!) / width) * 100, 12), 80) + '%', transform: 'translateX(-50%)' }}
            data-testid={testId ? `${testId}-tooltip` : undefined}
          >
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3 rounded" style={{ background: color }} aria-hidden="true" />
              <strong className="tabular-nums text-foreground">{tip.value.toLocaleString('en-IN')}</strong>
            </div>
            <div className="text-muted-foreground">{shortDate(tip.date)}</div>
          </div>
        )}
      </div>
    </figure>
  );
}
