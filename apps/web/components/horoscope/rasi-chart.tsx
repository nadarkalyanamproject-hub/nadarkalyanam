import { GRAHAS, RASIS, type GeneratedHoroscope } from '@nadar-kalyanam/schemas';

// The rasi chart in the South Indian style: the twelve signs sit in fixed
// boxes round the edge of a 4x4 grid (Meenam top left, then clockwise), each
// listing the grahas in it; "Lag" marks the lagnam. The middle is the title.
// [row, column] of each sign, in RASIS order (Mesham first).
const CELL: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [3, 0], [2, 0], [1, 0], [0, 0],
];

export function RasiChart({ chart, size = 'md' }: { chart: GeneratedHoroscope; size?: 'sm' | 'md' }) {
  const bySign = new Map<string, string[]>();
  for (const graha of GRAHAS) {
    const sign = chart.planets[graha.code];
    if (sign) bySign.set(sign, [...(bySign.get(sign) ?? []), graha.tamil]);
  }
  const text = size === 'sm' ? 'text-[10px]' : 'text-[11px] sm:text-xs';
  return (
    <div
      className="grid aspect-square w-full max-w-[340px] grid-cols-4 grid-rows-4 overflow-hidden rounded-xl border-2 border-nk-gold/70 bg-[#FFFDF8]"
      role="img"
      aria-label={`Rasi chart. Lagnam ${chart.lagnam}, rasi ${chart.rasi}.`}
      data-testid="rasi-chart"
    >
      {RASIS.map((rasi, i) => {
        const [row, col] = CELL[i]!;
        const grahas = bySign.get(rasi.code) ?? [];
        const isLagnam = chart.lagnam === rasi.code;
        return (
          <div
            key={rasi.code}
            style={{ gridRow: row + 1, gridColumn: col + 1 }}
            className={`flex flex-col border border-nk-gold/40 p-1 ${isLagnam ? 'bg-[#FFF3D6]' : ''}`}
          >
            <span className="text-[9px] uppercase tracking-wide text-nk-muted">{rasi.label}</span>
            <span className={`mt-0.5 flex flex-wrap gap-x-1 leading-tight ${text} font-semibold text-nk-maroon`}>
              {isLagnam && <span className="text-nk-saffron-text">Lag</span>}
              {grahas.map((g) => (
                <span key={g}>{g}</span>
              ))}
            </span>
          </div>
        );
      })}
      <div style={{ gridRow: '2 / span 2', gridColumn: '2 / span 2' }} className="flex flex-col items-center justify-center border border-nk-gold/40 text-center">
        <span className="font-[family-name:var(--font-heading,serif)] text-base font-bold text-nk-maroon">Rasi</span>
        <span className="text-[10px] text-nk-muted">South Indian chart</span>
      </div>
    </div>
  );
}
