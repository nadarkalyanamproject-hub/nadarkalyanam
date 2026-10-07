'use client';

import { useState } from 'react';
import type { HoroscopeView, PreferenceFit } from '@nadar-kalyanam/schemas';
import { FIT_KEY_LABELS, horoscopeViewRows, preferenceFitLine } from '../../lib/partner-preferences';
import { PhotoLightbox } from '../photo-lightbox';

// Another member's horoscope, exactly as the API allows THIS viewer to see
// it. "Not shared" covers both hidden and not-added.
export function HoroscopeCard({ view }: { view: HoroscopeView }) {
  const [enlarged, setEnlarged] = useState(false);
  const rows = horoscopeViewRows(view);
  const chartUrl = view.shared ? view.chartImageUrl : null;
  return (
    <div className="rounded-3xl border border-[#EFEAE2] bg-white p-6 sm:p-7 shadow-[0_4px_24px_rgba(0,0,0,0.02)]" data-testid="horoscope-card">
      <div className="border-b border-[#F1EBE1] pb-4">
        <h2 className="font-[family-name:var(--font-playfair)] font-serif text-lg sm:text-xl font-bold text-[#1E293B]">Horoscope</h2>
        <p className="text-xs text-[#7E6F65]">Shared at this member&apos;s choice</p>
      </div>
      {!view.shared ? (
        <p className="mt-4 text-sm text-[#7E6F65]" data-testid="horoscope-not-shared">
          Not shared.
        </p>
      ) : rows.length === 0 && !chartUrl ? (
        <p className="mt-4 text-sm text-[#7E6F65]" data-testid="horoscope-not-added">
          No horoscope details added yet.
        </p>
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2" data-testid="horoscope-rows">
            {rows.map((row) => (
              <div key={row.label} className="rounded-xl border border-[#F1EBE1] bg-[#FDFBF7] p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#7E6F65]">{row.label}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-[#241C1A]">{row.value}</dd>
              </div>
            ))}
          </dl>
          {chartUrl && (
            <button type="button" onClick={() => setEnlarged(true)} className="mt-4 block" aria-label="Enlarge jathagam chart">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
              <img src={chartUrl} alt="Jathagam chart" className="h-40 w-auto max-w-full rounded-lg border border-[#EFEAE2] object-contain" />
            </button>
          )}
        </>
      )}
      {enlarged && chartUrl && <PhotoLightbox url={chartUrl} onClose={() => setEnlarged(false)} />}
    </div>
  );
}

// "N of M of your preferences match" — only ever computed for the viewer.
export function PreferenceFitNote({ fit }: { fit: PreferenceFit | null }) {
  if (!fit) return null;
  return (
    <div className="rounded-2xl border border-[#EADBBD] bg-[#FFFBF0] px-4 py-3 text-sm" data-testid="preference-fit">
      <p className="font-semibold text-[#7A1C32]">{preferenceFitLine(fit)}</p>
      <p className="mt-1 text-xs text-[#5A493E]">
        {fit.fields.map((f) => `${FIT_KEY_LABELS[f.key]} ${f.matched === true ? '✓' : f.matched === false ? '✗' : '–'}`).join(' · ')}
      </p>
      <p className="mt-1 text-[11px] text-[#7E6F65]">Only you see this. It uses your own partner preferences.</p>
    </div>
  );
}
