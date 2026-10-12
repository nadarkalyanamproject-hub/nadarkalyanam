import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Bookmark,
  Briefcase,
  Calendar,
  ChevronRight,
  Eye,
  GraduationCap,
  Image as ImageIcon,
  MapPin,
  Plane,
  Sparkles,
  Star,
  Target,
  Users,
} from 'lucide-react';
import type { SearchCategory } from '../../lib/search-categories';
import { LotusEmblem } from './partner-search-bar';

// Each category's icon and colours (the same ones the old Matches hub used).
const TILE_STYLE: Record<string, { icon: ReactNode; bg: string; color: string }> = {
  'your-matches': { icon: <Users className="h-5 w-5" />, bg: 'bg-[#FDF2F2]', color: 'text-nk-maroon' },
  'shortlisted-by-you': { icon: <Bookmark className="h-5 w-5" />, bg: 'bg-[#FEF3C7]', color: 'text-[#D97706]' },
  'viewed-you': { icon: <Eye className="h-5 w-5" />, bg: 'bg-[#EDE9FE]', color: 'text-[#7C3AED]' },
  'shortlisted-you': { icon: <Star className="h-5 w-5" />, bg: 'bg-[#ECFDF5]', color: 'text-[#059669]' },
  'viewed-by-you': { icon: <Target className="h-5 w-5" />, bg: 'bg-[#FFE4E6]', color: 'text-[#E11D48]' },
  'newly-joined': { icon: <Calendar className="h-5 w-5" />, bg: 'bg-[#E0F2FE]', color: 'text-[#0284C7]' },
  nearby: { icon: <MapPin className="h-5 w-5" />, bg: 'bg-[#F3E8FF]', color: 'text-[#9333EA]' },
  'with-photos': { icon: <ImageIcon className="h-5 w-5" />, bg: 'bg-[#FFEDD5]', color: 'text-[#EA580C]' },
  'nri-matches': { icon: <Plane className="h-5 w-5" />, bg: 'bg-[#DBEAFE]', color: 'text-[#2563EB]' },
  'location-preference': { icon: <MapPin className="h-5 w-5" />, bg: 'bg-[#CCFBF1]', color: 'text-[#0D9488]' },
  'education-preference': { icon: <GraduationCap className="h-5 w-5" />, bg: 'bg-[#E0F2FE]', color: 'text-[#0284C7]' },
  'professional-preference': { icon: <Briefcase className="h-5 w-5" />, bg: 'bg-[#FEF3C7]', color: 'text-[#D97706]' },
  'mutual-matches': { icon: <Users className="h-5 w-5" />, bg: 'bg-[#FFEDD5]', color: 'text-[#EA580C]' },
  'star-matches': { icon: <Sparkles className="h-5 w-5" />, bg: 'bg-[#D1FAE5]', color: 'text-[#10B981]' },
  'horoscope-matches': { icon: <LotusEmblem className="h-5 w-5" />, bg: 'bg-[#FFE4E6]', color: 'text-[#E11D48]' },
};

// One category on the Search page. A real link (shareable, works with Back);
// a coming-soon category opens its explanation, never results.
export function CategoryTile({ category, href, selected }: { category: SearchCategory; href: string; selected: boolean }) {
  const style = TILE_STYLE[category.slug] ?? TILE_STYLE['your-matches'];
  const comingSoon = category.kind === 'coming-soon';
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? 'page' : undefined}
      data-testid={`category-${category.slug}`}
      className={`group flex items-center justify-between gap-3 rounded-2xl border bg-white p-3.5 shadow-2xs transition-all hover:shadow-xs sm:p-4 ${
        selected ? 'border-nk-maroon ring-1 ring-nk-maroon/30' : 'border-nk-line-gold/80 hover:border-[#C4B2A0]'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${style.bg} ${style.color} ${comingSoon ? 'opacity-60' : ''}`}>
          {style.icon}
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-xs font-bold text-nk-ink transition-colors group-hover:text-nk-maroon sm:text-sm">{category.title}</h3>
          <p className="truncate text-[11px] text-nk-muted sm:text-xs">{category.subtitle}</p>
        </div>
      </div>
      {comingSoon ? (
        <span className="shrink-0 rounded-full border border-nk-line-strong bg-nk-paper px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-nk-gold-text">
          Coming soon
        </span>
      ) : (
        <ChevronRight className="ml-1 h-4 w-4 shrink-0 text-[#A88C78] transition-all group-hover:translate-x-0.5 group-hover:text-nk-maroon" />
      )}
    </Link>
  );
}
