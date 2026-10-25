import type { ReactNode, SVGProps } from 'react';

// Full-colour illustrated icons for the profile sections, drawn from everyday
// Tamil family life rather than generic UI symbols. Each brings its own soft
// tinted tile, so show it bare (no chip background) at about 44px.
type IconProps = SVGProps<SVGSVGElement>;

const SKIN = { a: '#C68642', b: '#B5763A', c: '#A86B32', d: '#D08C4F' };
const HAIR = '#2B1B14';
const LINE = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function Tile({ bg, children, ...props }: IconProps & { bg: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <rect width="32" height="32" rx="9" fill={bg} />
      {children}
    </svg>
  );
}

// Basic Details: a framed portrait hanging on the wall.
export function PortraitIcon(props: IconProps) {
  return (
    <Tile bg="#FDE7D8" {...props}>
      <path d="M11 8.2 16 3.6l5 4.6" stroke="#8B5A2B" strokeWidth="1.1" {...LINE} />
      <circle cx="16" cy="3.6" r="1" fill="#8B5A2B" />
      <rect x="6.5" y="7.5" width="19" height="22" rx="9.5" fill="#D9A441" stroke="#8A5A1C" strokeWidth=".9" />
      <rect x="8.6" y="9.6" width="14.8" height="17.8" rx="7.4" fill="#FFF6EA" />
      <path d="M10.6 27c.9-3.2 3-5 5.4-5s4.5 1.8 5.4 5Z" fill="#9C2A33" />
      <circle cx="16" cy="16.2" r="3.3" fill={SKIN.a} />
      <path d="M12.7 16a3.3 3.3 0 0 1 6.6 0c-1-.9-2.1-1.3-3.3-1.3s-2.3.4-3.3 1.3Z" fill={HAIR} />
    </Tile>
  );
}

// Personal & Religious: a lit kuthuvilakku, the brass lamp of the home.
export function LampIcon(props: IconProps) {
  return (
    <Tile bg="#FFF1CC" {...props}>
      <circle cx="16" cy="7" r="5" fill="#FDE68A" opacity=".7" />
      <path d="M16 2.8c1.8 2 2.4 3.6 1.4 5.1a1.7 1.7 0 0 1-2.8 0c-1-1.5-.4-3.1 1.4-5.1Z" fill="#F97316" />
      <path d="M16 5.1c.8 1 1 1.8.5 2.5a.6.6 0 0 1-1 0c-.5-.7-.3-1.5.5-2.5Z" fill="#FDE047" />
      <path d="M9.5 6.5c1.1 1.2 1.4 2.2.8 3.1a1 1 0 0 1-1.6 0c-.6-.9-.3-1.9.8-3.1Z" fill="#F97316" />
      <path d="M22.5 6.5c1.1 1.2 1.4 2.2.8 3.1a1 1 0 0 1-1.6 0c-.6-.9-.3-1.9.8-3.1Z" fill="#F97316" />
      <path d="M5.5 11.4h21c-.9 2.8-5 4.3-10.5 4.3S6.4 14.2 5.5 11.4Z" fill="#E0A526" stroke="#9A6A12" strokeWidth=".9" {...LINE} />
      <rect x="15.2" y="15.6" width="1.6" height="9" fill="#C98B1E" />
      <ellipse cx="16" cy="20" rx="1.9" ry="2.2" fill="#E0A526" stroke="#9A6A12" strokeWidth=".9" />
      <path d="M10.5 28.5h11c-.6-2.7-2.7-4.5-5.5-4.5s-4.9 1.8-5.5 4.5Z" fill="#E0A526" stroke="#9A6A12" strokeWidth=".9" {...LINE} />
    </Tile>
  );
}

// Education & Career: an open book with a ribbon marker.
export function BookIcon(props: IconProps) {
  return (
    <Tile bg="#DCEBFF" {...props}>
      <path d="M3 9.8c3.8-1.1 8.2-.6 13 2.1 4.8-2.7 9.2-3.2 13-2.1v16.4c-3.8-1.1-8.2-.6-13 2.1-4.8-2.7-9.2-3.2-13-2.1Z" fill="#2F6FB5" />
      <path d="M4.5 8.6c3.6-1 7.3-.5 11.5 2v15.6c-4.2-2.4-7.9-2.9-11.5-1.9Z" fill="#FFFFFF" />
      <path d="M27.5 8.6c-3.6-1-7.3-.5-11.5 2v15.6c4.2-2.4 7.9-2.9 11.5-1.9Z" fill="#F4F8FF" />
      <path d="M7.4 13.3c2-.3 3.8 0 5.5.8M7.4 16.8c2-.3 3.8 0 5.5.8M7.4 20.3c2-.3 3.8 0 5.5.8M19.1 14.1c1.7-.8 3.5-1.1 5.5-.8M19.1 17.6c1.7-.8 3.5-1.1 5.5-.8" stroke="#93B4DD" strokeWidth="1.1" {...LINE} />
      <path d="M16 10.6v15.6" stroke="#2F6FB5" strokeWidth="1" />
      <path d="M21.6 9.2v6.6l1.6-1.3 1.6 1.3V8.7" fill="#E0453A" />
    </Tile>
  );
}

// Location: the family home, tiled roof and a kolam at the doorstep.
export function HomeKolamIcon(props: IconProps) {
  return (
    <Tile bg="#DDF2E3" {...props}>
      <rect x="4" y="25.6" width="24" height="5" rx="2.5" fill="#B98A66" />
      <circle cx="5.6" cy="22.6" r="2.4" fill="#4CAF50" />
      <circle cx="26.6" cy="23" r="2" fill="#3E9A44" />
      <rect x="7" y="13.6" width="18" height="12.4" fill="#FFF4DC" stroke="#8A5A3B" strokeWidth=".9" />
      <path d="M3.6 14.8 16 5l12.4 9.8Z" fill="#C8553D" stroke="#8A3324" strokeWidth=".9" {...LINE} />
      <path d="M9.6 12.3h12.8M12.6 9.9h6.8" stroke="#A8402C" strokeWidth=".8" {...LINE} />
      <rect x="9" y="16.6" width="3" height="3" rx=".4" fill="#7CC4E8" stroke="#8A5A3B" strokeWidth=".6" />
      <rect x="20" y="16.6" width="3" height="3" rx=".4" fill="#7CC4E8" stroke="#8A5A3B" strokeWidth=".6" />
      <path d="M13.6 26v-5.2a2.4 2.4 0 0 1 4.8 0V26Z" fill="#8B5A2B" />
      <path d="M16 26.6l2.1 1.6-2.1 1.6-2.1-1.6Z" stroke="#FFFFFF" strokeWidth=".9" {...LINE} />
      <circle cx="16" cy="28.2" r=".5" fill="#FFFFFF" />
      <circle cx="11.4" cy="28.2" r=".6" fill="#FFFFFF" />
      <circle cx="20.6" cy="28.2" r=".6" fill="#FFFFFF" />
    </Tile>
  );
}

// Family: father, mother in a saree, and their child.
export function FamilyIcon(props: IconProps) {
  return (
    <Tile bg="#FCE4EC" {...props}>
      <path d="M4 28.5v-8.4a4.5 4.5 0 0 1 9 0v8.4Z" fill="#0F766E" />
      <circle cx="8.5" cy="11.9" r="3.2" fill={SKIN.b} />
      <path d="M5.3 11.7a3.2 3.2 0 0 1 6.4 0c-1-.8-2-1.1-3.2-1.1s-2.2.3-3.2 1.1Z" fill={HAIR} />
      <path d="M19 28.5v-8.4a4.5 4.5 0 0 1 9 0v8.4Z" fill="#DB2777" />
      <path d="M20 17.6 27.6 25" stroke="#FBBF24" strokeWidth="1.3" {...LINE} />
      <circle cx="23.5" cy="11.9" r="3.2" fill={SKIN.a} />
      <path d="M20.3 11.7a3.2 3.2 0 0 1 6.4 0c-1-.8-2-1.1-3.2-1.1s-2.2.3-3.2 1.1Z" fill={HAIR} />
      <circle cx="26.8" cy="10.1" r="1.4" fill={HAIR} />
      <path d="M13.3 28.5v-3.9a2.7 2.7 0 0 1 5.4 0v3.9Z" fill="#F59E0B" />
      <circle cx="16" cy="18.8" r="2.3" fill={SKIN.d} />
      <path d="M13.7 18.6a2.3 2.3 0 0 1 4.6 0c-.7-.6-1.4-.8-2.3-.8s-1.6.2-2.3.8Z" fill={HAIR} />
    </Tile>
  );
}

// Lifestyle & Habits: filter coffee in a steel davara and tumbler.
export function CoffeeIcon(props: IconProps) {
  return (
    <Tile bg="#F3E3D3" {...props}>
      <path d="M14.2 8c-1.1-1.2 1.1-2.3 0-3.6M17.8 8c-1.1-1.2 1.1-2.3 0-3.6" stroke="#A1887F" strokeWidth="1.2" {...LINE} />
      <path d="M11 10.5h10l-1.2 13h-7.6Z" fill="#D5DAE1" stroke="#6B7280" strokeWidth=".9" {...LINE} />
      <ellipse cx="16" cy="10.9" rx="4.7" ry=".9" fill="#C08457" />
      <path d="M13.1 13.2l.6 9" stroke="#F3F5F8" strokeWidth="1.1" {...LINE} />
      <path d="M5 20.5h22c-.6 3.8-4.8 6.3-11 6.3S5.6 24.3 5 20.5Z" fill="#C3C9D1" stroke="#6B7280" strokeWidth=".9" {...LINE} />
      <path d="M8 22.4c1.8 1.6 4.6 2.4 8 2.4" stroke="#EEF1F5" strokeWidth="1.1" {...LINE} />
      <path d="M12.5 26.6 12 28.5h8l-.5-1.9" fill="#9CA3AF" stroke="#6B7280" strokeWidth=".9" {...LINE} />
    </Tile>
  );
}

// Horoscope: the South Indian rasi kattam, twelve houses around an open centre.
export function RasiChartIcon(props: IconProps) {
  return (
    <Tile bg="#FFE6D1" {...props}>
      <rect x="4" y="4" width="24" height="24" rx="1.5" fill="#FDBA74" />
      <rect x="10" y="10" width="12" height="12" fill="#FFF7ED" />
      <rect x="4" y="4" width="24" height="24" rx="1.5" stroke="#B45309" strokeWidth="1.2" />
      <path d="M10 4v24M22 4v24M4 10h24M4 22h24M16 4v6M16 22v6M4 16h6M22 16h6" stroke="#B45309" strokeWidth="1" />
      <circle cx="7" cy="7" r="1.2" fill="#7C3AED" />
      <circle cx="25" cy="13" r="1.2" fill="#16A34A" />
      <circle cx="13" cy="25" r="1.2" fill="#2563EB" />
      <path d="M16 12.4v1.1M16 18.5v1.1M12.4 16h1.1M18.5 16h1.1M13.5 13.5l.8.8M17.7 17.7l.8.8M18.5 13.5l-.8.8M14.3 17.7l-.8.8" stroke="#DC2626" strokeWidth=".9" {...LINE} />
      <circle cx="16" cy="16" r="1.8" fill="#DC2626" />
    </Tile>
  );
}

// Partner Preferences: a couple, jasmine in her hair, a heart between them.
export function CoupleIcon(props: IconProps) {
  return (
    <Tile bg="#FDE2E4" {...props}>
      <path d="M3.5 28.5c.5-4.9 3.4-8 7-8s6.5 3.1 7 8Z" fill="#F5F0E1" stroke="#9C8462" strokeWidth=".9" {...LINE} />
      <circle cx="10.5" cy="16.4" r="3.7" fill={SKIN.c} />
      <path d="M6.8 16.1a3.7 3.7 0 0 1 7.4 0c-1.1-.9-2.3-1.3-3.7-1.3s-2.6.4-3.7 1.3Z" fill={HAIR} />
      <path d="M14.5 28.5c.5-4.9 3.4-8 7-8s6.5 3.1 7 8Z" fill="#C81D25" />
      <path d="M16.1 28.5c.5-3.9 2.6-6.4 5.4-6.4" stroke="#F2B84B" strokeWidth="1.2" {...LINE} />
      <circle cx="21.5" cy="16.4" r="3.7" fill={SKIN.a} />
      <path d="M17.8 16.1a3.7 3.7 0 0 1 7.4 0c-1.1-.9-2.3-1.3-3.7-1.3s-2.6.4-3.7 1.3Z" fill={HAIR} />
      <circle cx="25.4" cy="13.8" r="1" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth=".4" />
      <circle cx="25.9" cy="15.8" r="1" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth=".4" />
      <circle cx="25.8" cy="17.9" r="1" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth=".4" />
      <path d="M16 8.6c-1.7-1.3-3-2.2-3-3.5a1.5 1.5 0 0 1 3-.5 1.5 1.5 0 0 1 3 .5c0 1.3-1.3 2.2-3 3.5Z" fill="#E11D48" />
    </Tile>
  );
}
