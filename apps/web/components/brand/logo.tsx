'use client';

import { useId } from 'react';

// The Nadar Kalyanam mark: the Nadar thali pendant. Two arches over one body,
// an open niche under each arch with a thin inner border, the lingam on its
// peedam (left), the standing goddess (right) and the "M" legs at the bottom.
// Source of truth: Desktop/Tech Arnik/Nadar Kalyanam/logo/gen.mjs. Parts carry
// nk-* classes so the splash and loading screens can animate them.
// fill 'metal' paints it soft gold (light at the top, deeper at the base).
export function LogoMark({ fill = 'metal', className }: { fill?: 'metal' | string; className?: string }) {
  const id = `nkm${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const paint = fill === 'metal' ? `url(#${id})` : fill;
  return (
    <svg viewBox="0 10 100 118" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true" focusable="false">
      {fill === 'metal' && (
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="20" y1="10" x2="80" y2="128">
            <stop offset="0" stopColor="#D9B45C" />
            <stop offset=".55" stopColor="#C89B3C" />
            <stop offset="1" stopColor="#B98B32" />
          </linearGradient>
        </defs>
      )}
      <g fill={paint}>
        <g className="nk-frame">
          {/* body minus the two niches and the two gaps between the legs */}
          <path
            fillRule="evenodd"
            d="M6 128V32A22 22 0 0 1 50 32A22 22 0 0 1 94 32V128ZM13.5 82V33A14.5 14.5 0 0 1 42.5 33V82ZM57.5 82V33A14.5 14.5 0 0 1 86.5 33V82ZM14 90H43V128H14ZM57 90H86V128H57Z"
          />
          <polyline points="14,90 28.5,118 43,90" fill="none" stroke={paint} strokeWidth="6.5" strokeLinejoin="miter" />
          <polyline points="57,90 71.5,118 86,90" fill="none" stroke={paint} strokeWidth="6.5" strokeLinejoin="miter" />
        </g>
        <g fill="none" stroke={paint} strokeWidth="1.3">
          <path className="nk-ring" pathLength={1} d="M16.3 79.2V33A11.7 11.7 0 0 1 39.7 33V79.2Z" />
          <path className="nk-ring" pathLength={1} d="M60.3 79.2V33A11.7 11.7 0 0 1 83.7 33V79.2Z" />
        </g>
        <g className="nk-lingam">
          <g transform="translate(28 77.4) scale(1.12) translate(-28 -77.4)">
            <path d="M18.8 63H37.2V66.2L34.2 69V70.4L37.2 73.4V77.4H18.8V73.4L21.8 70.4V69L18.8 66.2Z" />
            <path d="M22.8 63V53.2A5.2 5.2 0 0 1 33.2 53.2V63Z" />
            <path d="M20.4 61V52.6A7.6 7.6 0 0 1 35.6 52.6V61" fill="none" stroke={paint} strokeWidth="1.5" />
            <circle cx="20.4" cy="61" r="1.5" />
            <circle cx="35.6" cy="61" r="1.5" />
            <circle cx="28" cy="43.4" r="1.5" />
          </g>
        </g>
        <g className="nk-goddess">
          <g transform="translate(72 77.4) scale(1.1) translate(-72 -77.4)">
            <path d="M69.2 41.2L69.8 38.4H70.7L71.3 35.2H72.7L73.3 38.4H74.2L74.8 41.2Z" />
            <circle cx="72" cy="43" r="2.8" />
            <path d="M67.4 48Q72 46 76.6 48L75.3 58.4L77.9 74.4H66.1L68.7 58.4Z" />
            <g fill="none" stroke={paint} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M67.7 49.2L66.2 57.4" />
              <path d="M76.3 49.2L78.5 55L78.7 51" />
            </g>
            <rect x="64.8" y="74.6" width="14.4" height="2.8" />
          </g>
        </g>
      </g>
    </svg>
  );
}

// The full lockup: pendant beside NADAR over KALYANAM in Cinzel. Everything is
// in em of the NADAR size, so set font-size (e.g. text-[22px]) to size it; the
// pendant then spans exactly from the top of NADAR to the KALYANAM baseline.
export function Logo({ className = '', light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={`nk-logo ${light ? 'nk-logo-light' : ''} ${className}`} role="img" aria-label="Nadar Kalyanam">
      <LogoMark className="nk-logo-mark" />
      <span className="nk-logo-word" aria-hidden="true">
        <span className="nk-logo-a">NADAR</span>
        <span className="nk-logo-b">KALYANAM</span>
      </span>
    </span>
  );
}
