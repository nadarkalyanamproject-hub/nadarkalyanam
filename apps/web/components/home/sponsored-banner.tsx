'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Gem, X } from 'lucide-react';

export interface SponsoredAd {
  id: string;
  brand: string;
  subtitle: string;
  description: string;
  // Longer copy for the preview window.
  about: string;
  highlights: string[];
  tags: string[];
  ctaText: string;
  // The advertiser's own site, when they gave one. No link = no button,
  // never a dead "#".
  websiteUrl?: string;
  imageUrl: string;
  bgGradient: string;
  accentColor: string;
  buttonBg: string;
}

const DEFAULT_ADS: SponsoredAd[] = [
  {
    id: 'ad-manohar-jewellers',
    brand: 'Manohar Jewellers',
    subtitle: 'Exclusive Wedding Jewellery Collection',
    description: 'Traditional designs for your special day.',
    about:
      'Bridal sets, temple jewellery and everyday gold, made in the traditional South Indian style. Visit the showroom to see the full wedding collection and plan your set with the family.',
    highlights: ['Temple and antique bridal sets', 'Diamond necklaces and bangles', 'Custom orders for the wedding family'],
    tags: ['Gold', 'Diamond', 'Wedding Sets'],
    ctaText: 'View Collection',
    imageUrl: '/assets/manohar_jewellery.jpg',
    bgGradient: 'from-[#291710] via-[#382117] to-[#2A1711]',
    accentColor: '#DFC380',
    buttonBg: 'bg-[#FDE7B4] hover:bg-[#F8DC9E] text-nk-ink',
  },
  {
    id: 'ad-meenakshi-silks',
    brand: 'Sri Meenakshi Silks',
    subtitle: 'Handcrafted Bridal Kanchipuram Sarees',
    description: 'Pure zari bridal silks woven for sacred wedding muhurthams.',
    about:
      'Kanchipuram bridal pattu in pure zari, with matching silk dhotis and angavastrams for the groom. Bring your muhurtham colours and the weavers will help you choose.',
    highlights: ['Pure zari Kanchipuram pattu', 'Silk dhotis and angavastrams', 'Muhurtham colour matching'],
    tags: ['Kanchipuram', 'Bridal Pattu', 'Dhotis'],
    ctaText: 'Explore Silks',
    imageUrl: '/assets/meenakshi_silks.jpg',
    bgGradient: 'from-[#291216] via-[#381B1F] to-[#2C1417]',
    accentColor: '#E5B869',
    buttonBg: 'bg-[#FDE7B4] hover:bg-[#F8DC9E] text-[#291216]',
  },
];

function GoldLotusIcon({ className = 'h-7 w-7 text-[#DFC380]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className}>
      <path
        d="M20 6C20 6 22.5 13 25.5 16C28.5 19 34 20 34 20C34 20 28.5 21 25.5 24C22.5 27 20 34 20 34C20 34 17.5 27 14.5 24C11.5 21 6 20 6 20C6 20 11.5 19 14.5 16C17.5 13 20 6 20 6Z"
        fill="currentColor"
        opacity="0.35"
      />
      <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
      <path
        d="M20 10C21.5 14 24 16.5 28 18C24 19.5 21.5 22 20 26C18.5 22 16 19.5 12 18C16 16.5 18.5 14 20 10Z"
        fill="currentColor"
      />
    </svg>
  );
}

// The full ad, opened from the banner. Previous / next move through the same
// ads as the banner; Escape or a click outside closes it.
function AdPreview({
  ad,
  index,
  count,
  onPrev,
  onNext,
  onClose,
}: {
  ad: SponsoredAd;
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrev();
      else if (e.key === 'ArrowRight') onNext();
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
      data-testid="ad-preview"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-preview-title"
        className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-nk-ivory text-nk-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`relative h-48 shrink-0 bg-gradient-to-r sm:h-56 ${ad.bgGradient}`}>
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${ad.imageUrl}')` }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
          >
            <X className="h-4 w-4" />
          </button>
          <span className="absolute left-4 top-3.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">Sponsored</span>
          <div className="absolute bottom-3 left-4 right-4">
            <h2 id="ad-preview-title" className="text-xl font-bold text-white font-[family-name:var(--font-heading,serif)] sm:text-2xl">
              {ad.brand}
            </h2>
            <p className="text-sm font-semibold" style={{ color: ad.accentColor }}>
              {ad.subtitle}
            </p>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <p className="text-sm leading-relaxed text-[#443833]">{ad.about}</p>
          <ul className="mt-3 space-y-1.5">
            {ad.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-sm text-[#443833]">
                <Gem className="mt-0.5 h-3.5 w-3.5 shrink-0 text-nk-gold" />
                {h}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-nk-subtle">{ad.tags.join(' · ')}</p>
          <p className="mt-3 border-t border-[#F0E6DA] pt-3 text-[11px] text-nk-subtle">
            Sponsored listing. Nadar Kalyanam doesn&apos;t sell or vouch for advertisers&apos; products; please deal with them directly.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#F0E6DA] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPrev}
              disabled={count <= 1}
              aria-label="Previous ad"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-nk-line text-nk-ink-soft transition-colors hover:bg-[#F7F1E8] disabled:cursor-default disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[3rem] text-center text-xs text-nk-subtle" data-testid="ad-preview-position">
              {index + 1} of {count}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={count <= 1}
              aria-label="Next ad"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-nk-line text-nk-ink-soft transition-colors hover:bg-[#F7F1E8] disabled:cursor-default disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {ad.websiteUrl ? (
            <a
              href={ad.websiteUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-flex items-center gap-1.5 rounded-xl bg-nk-maroon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-nk-maroon-deep"
            >
              Visit website
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-[#DFC392] bg-[#FDF9F3] px-4 py-2 text-sm font-semibold text-nk-maroon-deep transition-colors hover:bg-[#F7EBDC]"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SponsoredBanner({ ads = DEFAULT_ADS }: { ads?: SponsoredAd[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const count = ads.length;

  const goPrev = useCallback(() => setCurrentIndex((i) => (i - 1 + count) % count), [count]);
  const goNext = useCallback(() => setCurrentIndex((i) => (i + 1) % count), [count]);
  const closePreview = useCallback(() => setPreviewOpen(false), []);

  // Auto-advance every 6 seconds, except while hovered or while the
  // preview is open (the slide mustn't change under the reader).
  useEffect(() => {
    if (isPaused || previewOpen || count <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % count);
    }, 6000);
    return () => clearInterval(timer);
  }, [isPaused, previewOpen, count]);

  if (count === 0) return null;

  const current = ads[currentIndex] ?? ads[0]!;

  return (
    <div
      className="w-full space-y-1.5"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      data-testid="sponsored-banner"
    >
      {/* Header bar: "SPONSORED" label + carousel dots */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-nk-subtle uppercase">SPONSORED</span>

        {count > 1 && (
          <div className="flex items-center gap-1.5">
            {ads.map((ad, idx) => (
              <button
                key={ad.id}
                type="button"
                aria-label={`Go to ad ${idx + 1}`}
                aria-current={idx === currentIndex}
                onClick={() => setCurrentIndex(idx)}
                className={`h-2 rounded-sm transition-all duration-300 cursor-pointer ${
                  idx === currentIndex ? 'w-5 bg-[#A89284]' : 'w-2 bg-[#DCD1C8] hover:bg-[#BDB0A6]'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main banner card. The whole card opens the preview; the arrows and
          the button sit on top of it as their own controls. */}
      <div
        className={`group relative w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm border border-[#482E24]/30 bg-gradient-to-r ${current.bgGradient} transition-all duration-500`}
        style={{ minHeight: '120px' }}
      >
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') goPrev();
            else if (e.key === 'ArrowRight') goNext();
          }}
          aria-label={`${current.brand}: ${current.subtitle}. Open ad`}
          className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#FDE7B4]"
        />

        <div className="relative flex flex-col md:flex-row items-center justify-between h-full">
          {/* Left section: product visual, faded into the banner */}
          <div className="relative w-full md:w-80 lg:w-96 h-36 md:h-28 shrink-0 overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{ backgroundImage: `url('${current.imageUrl}')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#2D1711]/60 to-[#2D1711] hidden md:block" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#2D1711] md:hidden" />
          </div>

          {/* Brand details */}
          <div className="flex-1 px-12 sm:px-14 py-4 md:py-2 flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3.5 text-center sm:text-left">
              <div className="hidden lg:flex shrink-0 p-2 rounded-xl bg-black/20 border border-white/5 backdrop-blur-xs">
                <GoldLotusIcon />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white tracking-wide font-[family-name:var(--font-heading,serif)]">
                  {current.brand}
                </h3>
                <p className="text-xs sm:text-sm font-semibold tracking-wide" style={{ color: current.accentColor }}>
                  {current.subtitle}
                </p>
                <p className="text-[11px] sm:text-xs text-[#E2D4CC]/85 hidden sm:block">{current.description}</p>
              </div>
            </div>

            {/* Tags & CTA */}
            <div className="flex flex-col sm:flex-row items-center gap-3.5 shrink-0">
              <div className="hidden xl:flex items-center gap-2 text-[11px] text-[#E8D4B8] font-medium bg-black/20 px-3 py-1.5 rounded-md border border-white/5">
                <Gem className="h-3 w-3 text-[#DFC380]" />
                {current.tags.map((tag, i) => (
                  <span key={tag} className="flex items-center gap-2">
                    <span>{tag}</span>
                    {i < current.tags.length - 1 && <span className="opacity-40">|</span>}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                data-testid="ad-cta"
                className={`relative z-20 inline-flex cursor-pointer items-center justify-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] ${current.buttonBg} whitespace-nowrap`}
              >
                <span>{current.ctaText}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous ad"
              data-testid="ad-prev"
              className="absolute left-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/55"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next ad"
              data-testid="ad-next"
              className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/55"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {previewOpen && (
        <AdPreview ad={current} index={currentIndex} count={count} onPrev={goPrev} onNext={goNext} onClose={closePreview} />
      )}
    </div>
  );
}
