'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Gem, Sparkles } from 'lucide-react';

export interface SponsoredAd {
  id: string;
  brand: string;
  subtitle: string;
  description: string;
  tags: string[];
  ctaText: string;
  ctaHref: string;
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
    tags: ['Gold', 'Diamond', 'Wedding Sets'],
    ctaText: 'View Collection',
    ctaHref: '#',
    imageUrl: '/assets/manohar_jewellery.jpg',
    bgGradient: 'from-[#291710] via-[#382117] to-[#2A1711]',
    accentColor: '#DFC380',
    buttonBg: 'bg-[#FDE7B4] hover:bg-[#F8DC9E] text-[#2B1515]',
  },
  {
    id: 'ad-meenakshi-silks',
    brand: 'Sri Meenakshi Silks',
    subtitle: 'Handcrafted Bridal Kanchipuram Sarees',
    description: 'Pure zari bridal silks woven for sacred wedding muhurthams.',
    tags: ['Kanchipuram', 'Bridal Pattu', 'Dhotis'],
    ctaText: 'Explore Silks',
    ctaHref: '#',
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

export function SponsoredBanner({ ads = DEFAULT_ADS }: { ads?: SponsoredAd[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-advance banner carousel every 6 seconds
  useEffect(() => {
    if (isPaused || ads.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [isPaused, ads.length]);

  if (!ads || ads.length === 0) return null;

  const current = ads[currentIndex] ?? ads[0];

  return (
    <div
      className="w-full space-y-1.5"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Header bar: "SPONSORED" label + Carousel dots */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-[#9E8B80] uppercase">
          SPONSORED
        </span>

        {ads.length > 1 && (
          <div className="flex items-center gap-1.5">
            {ads.map((ad, idx) => (
              <button
                key={ad.id}
                type="button"
                aria-label={`Go to slide ${idx + 1}`}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentIndex
                    ? 'w-4 bg-[#A89284]'
                    : 'w-1.5 bg-[#DCD1C8] hover:bg-[#BDB0A6]'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Banner Card */}
      <div
        className={`relative w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm border border-[#482E24]/30 bg-gradient-to-r ${current.bgGradient} transition-all duration-500`}
        style={{ minHeight: '120px' }}
      >
        {/* Carousel slide transition container */}
        <div className="relative flex flex-col md:flex-row items-center justify-between h-full">
          {/* Left section: Product / Brand Visual with subtle vignette fade */}
          <div className="relative w-full md:w-80 lg:w-96 h-36 md:h-28 shrink-0 overflow-hidden">
            {/* Background image */}
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
              style={{ backgroundImage: `url('${current.imageUrl}')` }}
            />
            {/* Smooth gradient blend into the banner background */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#2D1711]/60 to-[#2D1711] hidden md:block" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#2D1711] md:hidden" />
          </div>

          {/* Center section: Brand details & description */}
          <div className="flex-1 px-4 sm:px-6 py-4 md:py-2 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3.5 text-center sm:text-left">
              {/* Brand Logo Ornament */}
              <div className="hidden lg:flex shrink-0 p-2 rounded-xl bg-black/20 border border-white/5 backdrop-blur-xs">
                <GoldLotusIcon />
              </div>

              {/* Text Group */}
              <div className="space-y-0.5">
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white tracking-wide font-[family-name:var(--font-heading,serif)]">
                  {current.brand}
                </h3>
                <p
                  className="text-xs sm:text-sm font-semibold tracking-wide"
                  style={{ color: current.accentColor }}
                >
                  {current.subtitle}
                </p>
                <p className="text-[11px] sm:text-xs text-[#E2D4CC]/85 hidden sm:block">
                  {current.description}
                </p>
              </div>
            </div>

            {/* Right section: Tags & CTA Button */}
            <div className="flex flex-col sm:flex-row items-center gap-3.5 shrink-0">
              {/* Feature Tags */}
              <div className="hidden xl:flex items-center gap-2 text-[11px] text-[#E8D4B8] font-medium bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                <Gem className="h-3 w-3 text-[#DFC380]" />
                {current.tags.map((tag, i) => (
                  <span key={tag} className="flex items-center gap-2">
                    <span>{tag}</span>
                    {i < current.tags.length - 1 && <span className="opacity-40">|</span>}
                  </span>
                ))}
              </div>

              {/* Action Button */}
              <Link
                href={current.ctaHref}
                className={`inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] ${current.buttonBg} whitespace-nowrap`}
              >
                <span>{current.ctaText}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Floating internal dots indicator (as shown in reference screenshot top right) */}
        {ads.length > 1 && (
          <div className="absolute top-2.5 right-3.5 hidden sm:flex items-center gap-1.5 z-20 pointer-events-none">
            {ads.map((ad, idx) => (
              <span
                key={ad.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex
                    ? 'w-3.5 bg-white/90 shadow-xs'
                    : 'w-1.5 bg-white/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
