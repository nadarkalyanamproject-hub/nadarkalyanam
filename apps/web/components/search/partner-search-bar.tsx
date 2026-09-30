'use client';

import { type FormEvent } from 'react';
import type { SearchFilters } from '../../lib/search-query';
import {
  Briefcase,
  ChevronDown,
  GraduationCap,
  Heart,
  MapPin,
  RotateCcw,
  Search,
  User,
} from 'lucide-react';

export const AGE_MIN_OPTIONS = [
  '18', '19', '20', '21', '22', '23', '24', '25', '26', '27',
  '28', '29', '30', '31', '32', '33', '34', '35', '36', '37',
  '38', '39', '40', '42', '45', '50', '55', '60',
];

export const AGE_MAX_OPTIONS = [
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38', '39', '40',
  '42', '45', '50', '55', '60', '65', '70',
];

// City, education and profession are free text at onboarding (no fixed list
// exists), so they're typed here and matched on the whole value, ignoring
// case. Marital status and gender are enums: the option value is exactly
// what's stored; only the label is friendly.
export const MARITAL_STATUS_OPTIONS = [
  { value: 'NEVER_MARRIED', label: 'Never Married' },
  { value: 'DIVORCED', label: 'Divorced' },
  { value: 'WIDOWED', label: 'Widowed' },
  { value: 'AWAITING_DIVORCE', label: 'Awaiting Divorce' },
];

export const GENDER_OPTIONS = [
  { value: 'FEMALE', label: 'Bride' },
  { value: 'MALE', label: 'Groom' },
];

export function GoldenDoubleRings({ className = 'h-7 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 54 32" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="goldGradientRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#DFB258" />
          <stop offset="45%" stopColor="#C49746" />
          <stop offset="100%" stopColor="#9C7328" />
        </linearGradient>
      </defs>
      <ellipse
        cx="19"
        cy="16"
        rx="13"
        ry="11"
        stroke="url(#goldGradientRing)"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <ellipse
        cx="35"
        cy="16"
        rx="13"
        ry="11"
        stroke="url(#goldGradientRing)"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function InterlockingRingsIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="8.5" cy="12" r="5.5" />
      <circle cx="15.5" cy="12" r="5.5" />
    </svg>
  );
}

export function LotusEmblem({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      {/* Center upright petal */}
      <path
        d="M12 4C10.5 7.5 10.5 11.5 12 15C13.5 11.5 13.5 7.5 12 4Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      {/* Left petal */}
      <path
        d="M11 6C8.5 8.5 7 11.5 8.5 15C10 13.5 11 11 11.2 7"
        strokeLinecap="round"
      />
      {/* Right petal */}
      <path
        d="M13 6C15.5 8.5 17 11.5 15.5 15C14 13.5 13 11 12.8 7"
        strokeLinecap="round"
      />
      {/* Base petal curls */}
      <path
        d="M5 14C4 16 6 17.5 8.5 17C7.5 15.5 6.5 14.5 5 14Z"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path
        d="M19 14C20 16 18 17.5 15.5 17C16.5 15.5 17.5 14.5 19 14Z"
        fill="currentColor"
        fillOpacity="0.15"
      />
      {/* Lotus base underline */}
      <path
        d="M7 18C10.5 19.5 13.5 19.5 17 18"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BotanicalSprig({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Main graceful curved stem */}
      <path
        d="M20 200 C70 170 110 120 195 25"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Side branching stem 1 */}
      <path
        d="M80 145 C115 140 145 155 160 175"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Side branching stem 2 */}
      <path
        d="M130 95 C160 85 185 95 198 115"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Leaves along main stem */}
      <path
        d="M60 160 C50 140 68 128 82 142 C88 155 70 168 60 160 Z"
        fill="currentColor"
        fillOpacity="0.75"
      />
      <path
        d="M100 125 C88 108 108 95 120 108 C128 122 110 135 100 125 Z"
        fill="currentColor"
        fillOpacity="0.75"
      />
      <path
        d="M140 85 C128 68 148 55 160 68 C168 82 150 95 140 85 Z"
        fill="currentColor"
        fillOpacity="0.8"
      />
      <path
        d="M175 45 C168 30 185 20 194 32 C198 42 186 52 175 45 Z"
        fill="currentColor"
        fillOpacity="0.85"
      />
      {/* Terminal tip leaf */}
      <path
        d="M195 25 C190 12 205 6 212 16 C216 25 204 32 195 25 Z"
        fill="currentColor"
        fillOpacity="0.9"
      />

      {/* Opposite / side leaves */}
      <path
        d="M72 170 C85 180 88 198 74 195 C64 190 64 175 72 170 Z"
        fill="currentColor"
        fillOpacity="0.65"
      />
      <path
        d="M112 135 C125 145 128 162 114 160 C104 155 104 140 112 135 Z"
        fill="currentColor"
        fillOpacity="0.7"
      />
      <path
        d="M152 95 C165 105 168 122 154 120 C144 115 144 100 152 95 Z"
        fill="currentColor"
        fillOpacity="0.75"
      />
      <path
        d="M125 145 C145 142 155 152 150 162 C140 165 130 155 125 145 Z"
        fill="currentColor"
        fillOpacity="0.7"
      />
      <path
        d="M165 178 C175 172 185 180 180 190 C170 192 162 185 165 178 Z"
        fill="currentColor"
        fillOpacity="0.65"
      />
    </svg>
  );
}

interface PartnerSearchBarProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onSearch: (e?: FormEvent) => void;
  onClear: () => void;
  loading?: boolean;
  showBrandHeader?: boolean;
  className?: string;
}

export function PartnerSearchBar({
  filters,
  onChange,
  onSearch,
  onClear,
  loading = false,
  showBrandHeader = true,
  className = '',
}: PartnerSearchBarProps) {
  function handleFieldChange(field: keyof SearchFilters, value: string) {
    onChange({
      ...filters,
      [field]: value,
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSearch(e);
  }

  return (
    <div className={`w-full flex flex-col gap-6 ${className}`}>
      {/* Brand Header & Titles */}
      {showBrandHeader && (
        <div className="space-y-3">
          {/* Logo with golden double rings */}
          <div className="flex items-center gap-2.5">
            <GoldenDoubleRings className="h-6 w-10 sm:h-7 sm:w-11" />
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-[#70121A] font-[family-name:var(--font-heading,serif)]">
              Nadarkalyanam
            </span>
          </div>

          {/* Heading */}
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#241C1A] tracking-tight font-[family-name:var(--font-heading,serif)]">
              Find Your Life Partner
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#73645C] font-normal">
              Search by bride or groom, age, location, education, profession and marital status.
            </p>
          </div>
        </div>
      )}

      {/* Main Search Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#EADBBD]/80 p-5 sm:p-7 lg:p-8 shadow-[0_8px_30px_-6px_rgba(43,21,21,0.06)] transition-all">
        <form onSubmit={handleSubmit}>
          {/* 7 filters: 4 dropdowns (enums/ages) + 3 free-text fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5 lg:gap-4 items-end">
            {/* 0. Looking for (gender) */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="search-gender" className="flex items-center gap-1.5 text-xs font-semibold text-[#241C1A]">
                <Heart className="h-4 w-4 text-[#7A1118] shrink-0" />
                <span>Looking for</span>
              </label>
              <div className="relative">
                <select
                  id="search-gender"
                  value={filters.gender}
                  onChange={(e) => handleFieldChange('gender', e.target.value)}
                  className={`w-full appearance-none bg-white border border-[#DECDBB] hover:border-[#BFA892] focus:border-[#7A1118] focus:ring-1 focus:ring-[#7A1118] rounded-xl px-3.5 py-2.5 pr-8 text-xs sm:text-sm transition-colors outline-none cursor-pointer ${
                    filters.gender ? 'text-[#241C1A] font-medium' : 'text-[#8C7B73]'
                  }`}
                >
                  <option value="">Bride or Groom</option>
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} className="text-[#241C1A]">
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7B73]" />
              </div>
            </div>

            {/* 1. Min age */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="search-min-age" className="flex items-center gap-1.5 text-xs font-semibold text-[#241C1A]">
                <User className="h-4 w-4 text-[#7A1118] shrink-0" />
                <span>Min age</span>
              </label>
              <div className="relative">
                <select
                  id="search-min-age"
                  value={filters.ageMin}
                  onChange={(e) => handleFieldChange('ageMin', e.target.value)}
                  className={`w-full appearance-none bg-white border border-[#DECDBB] hover:border-[#BFA892] focus:border-[#7A1118] focus:ring-1 focus:ring-[#7A1118] rounded-xl px-3.5 py-2.5 pr-8 text-xs sm:text-sm transition-colors outline-none cursor-pointer ${
                    filters.ageMin ? 'text-[#241C1A] font-medium' : 'text-[#8C7B73]'
                  }`}
                >
                  <option value="">Select minimum age</option>
                  {AGE_MIN_OPTIONS.map((age) => (
                    <option key={`min-${age}`} value={age} className="text-[#241C1A]">
                      {age} yrs
                    </option>
                  ))}
                  {filters.ageMin && !AGE_MIN_OPTIONS.includes(filters.ageMin) && (
                    <option value={filters.ageMin} className="text-[#241C1A]">
                      {filters.ageMin} yrs
                    </option>
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7B73]" />
              </div>
            </div>

            {/* 2. Max age */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="search-max-age" className="flex items-center gap-1.5 text-xs font-semibold text-[#241C1A]">
                <User className="h-4 w-4 text-[#7A1118] shrink-0" />
                <span>Max age</span>
              </label>
              <div className="relative">
                <select
                  id="search-max-age"
                  value={filters.ageMax}
                  onChange={(e) => handleFieldChange('ageMax', e.target.value)}
                  className={`w-full appearance-none bg-white border border-[#DECDBB] hover:border-[#BFA892] focus:border-[#7A1118] focus:ring-1 focus:ring-[#7A1118] rounded-xl px-3.5 py-2.5 pr-8 text-xs sm:text-sm transition-colors outline-none cursor-pointer ${
                    filters.ageMax ? 'text-[#241C1A] font-medium' : 'text-[#8C7B73]'
                  }`}
                >
                  <option value="">Select maximum age</option>
                  {AGE_MAX_OPTIONS.map((age) => (
                    <option key={`max-${age}`} value={age} className="text-[#241C1A]">
                      {age} yrs
                    </option>
                  ))}
                  {filters.ageMax && !AGE_MAX_OPTIONS.includes(filters.ageMax) && (
                    <option value={filters.ageMax} className="text-[#241C1A]">
                      {filters.ageMax} yrs
                    </option>
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7B73]" />
              </div>
            </div>

            {/* 3. City / Location */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="search-city" className="flex items-center gap-1.5 text-xs font-semibold text-[#241C1A]">
                <MapPin className="h-4 w-4 text-[#7A1118] shrink-0" />
                <span>City / Location</span>
              </label>
              <div className="relative">
                <input
                  id="search-city"
                  type="text"
                  value={filters.city}
                  onChange={(e) => handleFieldChange('city', e.target.value)}
                  placeholder="e.g. Madurai"
                  className="w-full bg-white border border-[#DECDBB] hover:border-[#BFA892] focus:border-[#7A1118] focus:ring-1 focus:ring-[#7A1118] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#241C1A] font-medium placeholder:font-normal placeholder:text-[#8C7B73] transition-colors outline-none"
                />
              </div>
            </div>

            {/* 4. Education */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="search-education" className="flex items-center gap-1.5 text-xs font-semibold text-[#241C1A]">
                <GraduationCap className="h-4 w-4 text-[#7A1118] shrink-0" />
                <span>Education</span>
              </label>
              <div className="relative">
                <input
                  id="search-education"
                  type="text"
                  value={filters.educationLevel}
                  onChange={(e) => handleFieldChange('educationLevel', e.target.value)}
                  placeholder="e.g. Bachelors"
                  className="w-full bg-white border border-[#DECDBB] hover:border-[#BFA892] focus:border-[#7A1118] focus:ring-1 focus:ring-[#7A1118] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#241C1A] font-medium placeholder:font-normal placeholder:text-[#8C7B73] transition-colors outline-none"
                />
              </div>
            </div>

            {/* 5. Profession */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="search-profession" className="flex items-center gap-1.5 text-xs font-semibold text-[#241C1A]">
                <Briefcase className="h-4 w-4 text-[#7A1118] shrink-0" />
                <span>Profession</span>
              </label>
              <div className="relative">
                <input
                  id="search-profession"
                  type="text"
                  value={filters.profession}
                  onChange={(e) => handleFieldChange('profession', e.target.value)}
                  placeholder="e.g. Software Engineer"
                  className="w-full bg-white border border-[#DECDBB] hover:border-[#BFA892] focus:border-[#7A1118] focus:ring-1 focus:ring-[#7A1118] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#241C1A] font-medium placeholder:font-normal placeholder:text-[#8C7B73] transition-colors outline-none"
                />
              </div>
            </div>

            {/* 6. Marital status */}
            <div className="space-y-1.5 text-left">
              <label htmlFor="search-marital-status" className="flex items-center gap-1.5 text-xs font-semibold text-[#241C1A]">
                <InterlockingRingsIcon className="h-4 w-4 text-[#7A1118] shrink-0" />
                <span>Marital status</span>
              </label>
              <div className="relative">
                <select
                  id="search-marital-status"
                  value={filters.maritalStatus}
                  onChange={(e) => handleFieldChange('maritalStatus', e.target.value)}
                  className={`w-full appearance-none bg-white border border-[#DECDBB] hover:border-[#BFA892] focus:border-[#7A1118] focus:ring-1 focus:ring-[#7A1118] rounded-xl px-3.5 py-2.5 pr-8 text-xs sm:text-sm transition-colors outline-none cursor-pointer ${
                    filters.maritalStatus ? 'text-[#241C1A] font-medium' : 'text-[#8C7B73]'
                  }`}
                >
                  <option value="">Select marital status</option>
                  {MARITAL_STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value} className="text-[#241C1A]">
                      {status.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7B73]" />
              </div>
            </div>
          </div>

          {/* Action Row: Left buttons + Right ornamental tagline */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5 mt-6 pt-2">
            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-[#7A1118] hover:bg-[#620D13] active:scale-[0.99] text-white shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Search className="h-4 w-4" />
                <span>{loading ? 'Searching…' : 'Search'}</span>
              </button>

              <button
                type="button"
                onClick={onClear}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-white hover:bg-[#FAF7F2] active:scale-[0.99] text-[#4A3D36] border border-[#DECDBB] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#5A4D45]" />
                <span>Clear</span>
              </button>
            </div>

            {/* Right Side Lotus Motif & Tagline */}
            <div className="flex flex-col items-center sm:items-end justify-center">
              <div className="flex items-center gap-2.5">
                <span className="w-10 sm:w-16 h-px bg-[#EADBBD]" />
                <LotusEmblem className="h-4 w-4 text-[#B89B7D]" />
                <span className="w-10 sm:w-16 h-px bg-[#EADBBD]" />
              </div>
              <p className="text-[11px] sm:text-xs text-[#8C7B73] font-serif italic tracking-wider mt-1 text-center sm:text-right">
                Better matches. Brighter futures.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
