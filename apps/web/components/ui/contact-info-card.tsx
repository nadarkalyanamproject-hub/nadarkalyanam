'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Info, PhoneCall, Sparkles, CheckCircle2, X } from 'lucide-react';

export interface ContactInfoCardProps {
  planType: 'gold-plus' | 'gold-premium';
  triggerText?: string;
  position?: 'top' | 'bottom';
  align?: 'center' | 'left' | 'right';
  className?: string;
}

export function ContactInfoCard({
  planType,
  triggerText,
  position = 'bottom',
  align = 'center',
  className = '',
}: ContactInfoCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isGoldPlus = planType === 'gold-plus';
  const planBadge = isGoldPlus ? 'Gold Plus' : 'Gold Premium';
  const newNos = isGoldPlus ? '75 New Numbers' : '200 New Numbers';
  const newNosDesc = isGoldPlus
    ? 'View and contact up to 75 new verified phone numbers.'
    : 'View and contact up to 200 new verified phone numbers.';

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const alignmentClass =
    align === 'left'
      ? 'left-0'
      : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2';

  const positionClass =
    position === 'top'
      ? 'bottom-full mb-2.5'
      : 'top-full mt-2.5';

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center gap-1.5 ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {triggerText && <span>{triggerText}</span>}

      <button
        type="button"
        onClick={handleToggle}
        aria-label={`View ${planBadge} phone numbers breakdown`}
        aria-expanded={isOpen}
        className="group relative inline-flex items-center justify-center h-4 w-4 rounded-full bg-[#FAF5EC] text-[#8C7B73] hover:text-[#680A0E] hover:bg-[#F3E5D4] border border-[#E8DCCF] transition-all cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[#C89B3C]"
      >
        <Info className="h-2.5 w-2.5 stroke-[2.5]" />
      </button>

      {/* Popover Info Card */}
      {isOpen && (
        <div
          role="tooltip"
          className={`absolute ${positionClass} ${alignmentClass} z-50 w-72 sm:w-80 rounded-2xl bg-white border border-[#E8DCCF] shadow-2xl p-4 text-left transition-all duration-150 animate-in fade-in zoom-in-95`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#F4ECE3]">
            <div className="space-y-0.5">
              <span className="inline-block text-[10px] font-extrabold uppercase tracking-widest text-[#C89B3C] bg-[#FAF5EC] px-2 py-0.5 rounded-full border border-[#EEDFCD]">
                {planBadge}
              </span>
              <h4 className="text-xs sm:text-sm font-bold text-[#2B1515] leading-tight">
                Phone Number Access Breakdown
              </h4>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="text-[#8C7B73] hover:text-[#2B1515] p-1 rounded-md hover:bg-[#FAF5EC] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Breakdown Items */}
          <div className="py-2.5 space-y-2 text-xs text-[#443833]">
            {/* 1. Unlimited received interests */}
            <div className="flex items-start gap-2.5 bg-[#FAF5EC]/70 rounded-xl p-2.5 border border-[#F0E6D8]">
              <div className="h-5 w-5 rounded-full bg-[#EADBBD] text-[#680A0E] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-3 w-3" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-[#2B1515]">
                  Unlimited Phone Numbers
                </p>
                <p className="text-[11px] text-[#73645C] mt-0.5 leading-relaxed">
                  You can see unlimited phone numbers of members who sent interests to you.
                </p>
              </div>
            </div>

            {/* 2. New Numbers allowance */}
            <div className="flex items-start gap-2.5 bg-[#FFF9F2] rounded-xl p-2.5 border border-[#F3DFBE]">
              <div className="h-5 w-5 rounded-full bg-[#C89B3C]/20 text-[#C89B3C] flex items-center justify-center shrink-0 mt-0.5">
                <PhoneCall className="h-3 w-3" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-[#680A0E]">
                  {newNos}
                </p>
                <p className="text-[11px] text-[#73645C] mt-0.5 leading-relaxed">
                  {newNosDesc}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-[#F4ECE3] flex items-center gap-1.5 text-[10px] text-[#8C7B73]">
            <CheckCircle2 className="h-3 w-3 text-[#C89B3C] shrink-0" />
            <span>100% verified Nadar community phone numbers.</span>
          </div>

          {/* Arrow */}
          <div
            className={`absolute h-3 w-3 rotate-45 bg-white ${
              position === 'top'
                ? '-bottom-1.5 border-r border-b border-[#E8DCCF]'
                : '-top-1.5 border-l border-t border-[#E8DCCF]'
            } ${
              align === 'left'
                ? 'left-4'
                : align === 'right'
                ? 'right-4'
                : 'left-1/2 -translate-x-1/2'
            }`}
          />
        </div>
      )}
    </div>
  );
}
