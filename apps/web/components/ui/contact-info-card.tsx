'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';

export interface ContactInfoCardProps {
  // The plan's phone number allowance (null = unlimited), from the API.
  phoneUnlockLimit: number | null;
  position?: 'top' | 'bottom';
  align?: 'center' | 'left' | 'right';
  className?: string;
}

// Explains a plan's phone-number feature: what an unlock is, whose numbers
// can be unlocked, and what "verified" means (OTP-confirmed, not ID).
export function ContactInfoCard({ phoneUnlockLimit, position = 'bottom', align = 'center', className = '' }: ContactInfoCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isOpen]);

  const alignmentClass = align === 'left' ? 'left-0' : align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2';
  const positionClass = position === 'top' ? 'bottom-full mb-2.5' : 'top-full mt-2.5';
  const allowance = phoneUnlockLimit === null ? 'unlimited unlocks' : `up to ${phoneUnlockLimit} unlocks`;

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label="About phone numbers"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.preventDefault();
          setIsOpen((open) => !open);
        }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[#A88C78] hover:text-[#680A0E]"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {isOpen && (
        <div
          role="dialog"
          className={`absolute z-30 w-64 max-w-[80vw] rounded-xl border border-[#E8DCCF] bg-white p-3 text-left text-[11px] leading-relaxed text-[#5A493E] shadow-lg ${positionClass} ${alignmentClass}`}
          data-testid="phone-info"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="font-bold text-[#680A0E]">Phone number unlocks</span>
            <button type="button" aria-label="Close" onClick={() => setIsOpen(false)} className="text-[#A88C78] hover:text-[#2B1515]">
              <X className="h-3 w-3" />
            </button>
          </div>
          <p>
            Unlock the phone number of a member you&apos;re connected with, if they&apos;ve allowed it in their privacy
            settings. This plan includes {allowance}; unlocking the same member again is free.
          </p>
          <p className="mt-1">
            &ldquo;Verified&rdquo; means the number was confirmed with a one-time code (OTP), not an ID check.
          </p>
        </div>
      )}
    </div>
  );
}
