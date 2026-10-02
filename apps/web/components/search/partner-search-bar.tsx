'use client';

import { type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import type { SearchFilters } from '../../lib/search-query';
import { COMING_SOON } from '../../lib/coming-soon';
import { ComingSoonNote } from '../ui/coming-soon-note';
import {
  Briefcase,
  ChevronDown,
  Clock,
  Crown,
  Flower2,
  House,
  MapPin,
  RotateCcw,
  Search,
  User,
  Utensils,
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

// Free-text profile fields (city, education, profession, mother tongue,
// religion, caste, employment type) have no fixed list at onboarding, so
// they're typed here and matched on the whole value, ignoring case. Enum
// fields use the stored value as the option value; only the label is
// friendly.
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

// The onboarding height picker's own list (4'6" to 6'6"); the value is the
// centimetre figure the search API compares.
export const HEIGHT_OPTIONS = Array.from({ length: 78 - 54 + 1 }, (_, i) => {
  const totalInches = 54 + i;
  const cm = Math.round(totalInches * 2.54);
  return { value: String(cm), label: `${Math.floor(totalInches / 12)}'${totalInches % 12}" (${cm} cm)` };
});

const PHYSICAL_STATUS_OPTIONS = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'PHYSICALLY_CHALLENGED', label: 'Physically challenged' },
];

const DOSHAM_OPTIONS = [
  { value: 'NO', label: 'No' },
  { value: 'YES', label: 'Yes' },
  { value: 'DONT_KNOW', label: "Don't know" },
];

const FAMILY_STATUS_OPTIONS = ['Middle Class', 'Upper Middle Class', 'Rich / Affluent (Elite)'].map((value) => ({
  value,
  label: value,
}));

// Annual income is entered in lakhs at onboarding ("e.g. 10-15 LPA").
export const INCOME_LAKH_OPTIONS = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50, 75, 100].map((lakhs) => ({
  value: String(lakhs),
  label: lakhs >= 100 ? `₹${lakhs / 100} Cr` : `₹${lakhs} L`,
}));

const JOINED_OPTIONS = [
  { value: '', label: 'All' },
  { value: '1', label: 'Today' },
  { value: '3', label: 'Last 3 days' },
  { value: '7', label: 'One week' },
  { value: '30', label: 'One month' },
];

const AGE_SELECT_MIN = AGE_MIN_OPTIONS.map((age) => ({ value: age, label: `${age} yrs` }));
const AGE_SELECT_MAX = AGE_MAX_OPTIONS.map((age) => ({ value: age, label: `${age} yrs` }));

// Filters shown on the page but not searchable yet: no profile stores this
// data, so they have no input and no filter state, and can't reach a query.
// The wording is shared with the Profile page (lib/coming-soon.ts).
const SEARCH_COMING_SOON = ['profileCreatedBy', 'star', 'institution', 'citizenship', 'habits', 'hobbies', 'familyValue'] as const;
export const COMING_SOON_FILTERS = Object.fromEntries(SEARCH_COMING_SOON.map((key) => [key, COMING_SOON[key]])) as Pick<
  typeof COMING_SOON,
  (typeof SEARCH_COMING_SOON)[number]
>;

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

const CONTROL_CLASS =
  'w-full bg-white border border-[#DECDBB] hover:border-[#BFA892] focus:border-[#7A1118] focus:ring-1 focus:ring-[#7A1118] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm transition-colors outline-none';

type Option = { value: string; label: string };

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  const className = 'block text-xs font-semibold text-[#241C1A]';
  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ) : (
    <span className={className}>{children}</span>
  );
}

function SelectControl({
  id,
  value,
  onChange,
  placeholder,
  options,
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Option[];
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${CONTROL_CLASS} appearance-none pr-8 cursor-pointer ${
          value ? 'text-[#241C1A] font-medium' : 'text-[#8C7B73]'
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} className="text-[#241C1A]">
            {option.label}
          </option>
        ))}
        {value && !options.some((option) => option.value === value) && (
          <option value={value} className="text-[#241C1A]">
            {value}
          </option>
        )}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7B73]" />
    </div>
  );
}

function SelectField(props: { id: string; label: string } & Parameters<typeof SelectControl>[0]) {
  return (
    <div className="space-y-1.5 text-left">
      <FieldLabel htmlFor={props.id}>{props.label}</FieldLabel>
      <SelectControl {...props} />
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1.5 text-left">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${CONTROL_CLASS} text-[#241C1A] font-medium placeholder:font-normal placeholder:text-[#8C7B73]`}
      />
    </div>
  );
}

// Two selects under one label: "from" and "to".
function RangeField({
  id,
  label,
  min,
  max,
  onMin,
  onMax,
  minOptions,
  maxOptions,
}: {
  id: string;
  label: string;
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
  minOptions: Option[];
  maxOptions: Option[];
}) {
  return (
    <fieldset className="space-y-1.5 text-left">
      <legend className="block text-xs font-semibold text-[#241C1A] mb-1.5">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <SelectControl id={`${id}-min`} ariaLabel={`${label} from`} value={min} onChange={onMin} placeholder="From" options={minOptions} />
        <SelectControl id={`${id}-max`} ariaLabel={`${label} to`} value={max} onChange={onMax} placeholder="To" options={maxOptions} />
      </div>
    </fieldset>
  );
}

function CheckboxField({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-2.5 rounded-xl border border-[#DECDBB] hover:border-[#BFA892] bg-white px-3.5 py-2.5 cursor-pointer transition-colors"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#7A1118] cursor-pointer"
      />
      <span className="min-w-0">
        <span className="block text-xs sm:text-sm font-medium text-[#241C1A]">{label}</span>
        {hint && <span className="block text-[11px] sm:text-xs text-[#73645C] mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

function ComingSoonField({ filter }: { filter: keyof typeof COMING_SOON_FILTERS }) {
  return <ComingSoonNote feature={filter} testId="coming-soon-filter" />;
}

function Section({
  id,
  title,
  icon,
  children,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="bg-white rounded-2xl sm:rounded-3xl border border-[#EADBBD]/80 p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(43,21,21,0.05)]"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <span className="h-9 w-9 rounded-full bg-[#FAF7F2] border border-[#DECDBB] flex items-center justify-center text-[#7A1118] shrink-0">
          {icon}
        </span>
        <h2 id={id} className="text-base sm:text-lg font-bold text-[#241C1A] font-[family-name:var(--font-heading,serif)]">
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 lg:gap-4 items-start">{children}</div>
    </section>
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
  // Total matches from the last completed search (null before any search),
  // and whether the filters have changed since that search ran.
  matchCount?: number | null;
  countIsStale?: boolean;
}

export function PartnerSearchBar({
  filters,
  onChange,
  onSearch,
  onClear,
  loading = false,
  showBrandHeader = true,
  className = '',
  matchCount = null,
  countIsStale = false,
}: PartnerSearchBarProps) {
  const set = (field: keyof SearchFilters) => (value: string) => onChange({ ...filters, [field]: value });
  const setFlag = (field: keyof SearchFilters) => (checked: boolean) =>
    onChange({ ...filters, [field]: checked ? 'true' : '' });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSearch(e);
  }

  let countText: ReactNode;
  if (loading) countText = 'Searching…';
  // Searching with no filters is allowed and lists every member (paginated).
  else if (matchCount === null) countText = 'Select filters and click Search to find matches.';
  else if (countIsStale) countText = 'Filters changed. Search again to update the count.';
  else
    countText = (
      <>
        <span className="text-[#7A1118] font-bold" data-testid="match-count">
          {matchCount.toLocaleString('en-IN')}
        </span>{' '}
        {matchCount === 1 ? 'profile matches' : 'profiles match'} your search
      </>
    );

  return (
    <div className={`w-full flex flex-col gap-6 ${className}`}>
      {showBrandHeader && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <GoldenDoubleRings className="h-6 w-10 sm:h-7 sm:w-11" />
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-[#70121A] font-[family-name:var(--font-heading,serif)]">
              Nadarkalyanam
            </span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#241C1A] tracking-tight font-[family-name:var(--font-heading,serif)]">
              Find Your Life Partner
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#73645C] font-normal">
              Search by basic, religious, professional, location and family details.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Decorative only: no plan check, and nothing here unlocks a filter. */}
        <div className="rounded-2xl border border-[#E6D3B0] bg-gradient-to-r from-[#FFF8EC] to-[#FAF7F2] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="h-9 w-9 rounded-full bg-white border border-[#E6D3B0] flex items-center justify-center text-[#9C7328] shrink-0">
              <Crown className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#241C1A]">More premium filters are on the way</p>
              <p className="text-xs text-[#73645C] mt-0.5">
                Fields marked <span className="font-semibold">Coming soon</span> can be searched once members can add that
                detail to their profile. No plan unlocks them yet.
              </p>
            </div>
          </div>
          <Link
            href="/membership"
            className="self-start sm:self-auto shrink-0 px-4 py-2 rounded-full border border-[#C49746] text-[#9C7328] hover:bg-[#C49746]/10 text-xs font-semibold transition-colors whitespace-nowrap"
          >
            View Membership
          </Link>
        </div>

        <Section id="search-basic" title="Basic Details" icon={<User className="h-4 w-4" />}>
          <SelectField id="search-gender" label="Looking for" value={filters.gender} onChange={set('gender')} placeholder="Bride or Groom" options={GENDER_OPTIONS} />
          <RangeField id="search-age" label="Age" min={filters.ageMin} max={filters.ageMax} onMin={set('ageMin')} onMax={set('ageMax')} minOptions={AGE_SELECT_MIN} maxOptions={AGE_SELECT_MAX} />
          <RangeField id="search-height" label="Height" min={filters.heightMinCm} max={filters.heightMaxCm} onMin={set('heightMinCm')} onMax={set('heightMaxCm')} minOptions={HEIGHT_OPTIONS} maxOptions={HEIGHT_OPTIONS} />
          <SelectField id="search-marital-status" label="Marital status" value={filters.maritalStatus} onChange={set('maritalStatus')} placeholder="Any" options={MARITAL_STATUS_OPTIONS} />
          <TextField id="search-mother-tongue" label="Mother tongue" value={filters.motherTongue} onChange={set('motherTongue')} placeholder="e.g. Tamil" />
          <SelectField id="search-physical-status" label="Physical status" value={filters.physicalStatus} onChange={set('physicalStatus')} placeholder="Any" options={PHYSICAL_STATUS_OPTIONS} />
          <ComingSoonField filter="profileCreatedBy" />
        </Section>

        <Section id="search-religious" title="Religious Details" icon={<Flower2 className="h-4 w-4" />}>
          <TextField id="search-religion" label="Religion" value={filters.religion} onChange={set('religion')} placeholder="e.g. Hindu" />
          <TextField id="search-caste" label="Caste" value={filters.casteCommunity} onChange={set('casteCommunity')} placeholder="e.g. Nadar" />
          <SelectField id="search-dosham" label="Dosham" value={filters.dosham} onChange={set('dosham')} placeholder="Any" options={DOSHAM_OPTIONS} />
          <ComingSoonField filter="star" />
        </Section>

        <Section id="search-professional" title="Professional Details" icon={<Briefcase className="h-4 w-4" />}>
          <TextField id="search-education" label="Education" value={filters.educationLevel} onChange={set('educationLevel')} placeholder="e.g. Bachelors" />
          <TextField id="search-profession" label="Occupation" value={filters.profession} onChange={set('profession')} placeholder="e.g. Software Engineer" />
          <TextField id="search-employed-in" label="Employment type" value={filters.employedIn} onChange={set('employedIn')} placeholder="e.g. Private, Government" />
          <RangeField id="search-income" label="Annual income" min={filters.incomeMinLakhs} max={filters.incomeMaxLakhs} onMin={set('incomeMinLakhs')} onMax={set('incomeMaxLakhs')} minOptions={INCOME_LAKH_OPTIONS} maxOptions={INCOME_LAKH_OPTIONS} />
          <ComingSoonField filter="institution" />
        </Section>

        <Section id="search-location" title="Location Details" icon={<MapPin className="h-4 w-4" />}>
          <div className="space-y-1.5 text-left">
            <FieldLabel htmlFor="search-country">Country</FieldLabel>
            {/* Single-option select, as at onboarding: India is the only country. */}
            <div className="relative">
              <select
                id="search-country"
                value={filters.country}
                onChange={(e) => set('country')(e.target.value)}
                className={`${CONTROL_CLASS} appearance-none pr-8 cursor-pointer text-[#241C1A] font-medium`}
              >
                <option value="India">India</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C7B73]" />
            </div>
          </div>
          <TextField id="search-city" label="City" value={filters.city} onChange={set('city')} placeholder="e.g. Madurai" />
          <div className="space-y-1.5 text-left">
            <FieldLabel>Nearby profiles</FieldLabel>
            <CheckboxField
              id="search-nearby"
              label="Only profiles near me"
              hint="Same city or state as your profile, as in Matches › Nearby."
              checked={filters.nearby === 'true'}
              onChange={setFlag('nearby')}
            />
          </div>
          <ComingSoonField filter="citizenship" />
        </Section>

        <Section id="search-lifestyle" title="Lifestyle" icon={<Utensils className="h-4 w-4" />}>
          <ComingSoonField filter="habits" />
          <ComingSoonField filter="hobbies" />
        </Section>

        <Section id="search-family" title="Family Details" icon={<House className="h-4 w-4" />}>
          <SelectField id="search-family-status" label="Family status" value={filters.familyType} onChange={set('familyType')} placeholder="Any" options={FAMILY_STATUS_OPTIONS} />
          <ComingSoonField filter="familyValue" />
        </Section>

        <Section id="search-recent" title="Recently Created Profiles" icon={<Clock className="h-4 w-4" />}>
          <fieldset className="space-y-1.5 text-left sm:col-span-2 lg:col-span-3">
            <legend className="block text-xs font-semibold text-[#241C1A] mb-1.5">Profile created</legend>
            <div className="flex flex-wrap gap-2">
              {JOINED_OPTIONS.map((option) => {
                const active = filters.joinedWithinDays === option.value;
                return (
                  <label
                    key={option.value || 'all'}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#7A1118] border-[#7A1118] text-white'
                        : 'bg-white border-[#DECDBB] text-[#4A3D36] hover:border-[#BFA892]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="search-joined"
                      value={option.value}
                      checked={active}
                      onChange={() => set('joinedWithinDays')(option.value)}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="space-y-1.5 text-left">
            <FieldLabel>Profile type</FieldLabel>
            <CheckboxField id="search-with-photo" label="Profiles with photo" checked={filters.withPhoto === 'true'} onChange={setFlag('withPhoto')} />
            <CheckboxField
              id="search-verified"
              label="Verified profiles only"
              hint="Members whose identity verification is complete."
              checked={filters.verified === 'true'}
              onChange={setFlag('verified')}
            />
          </div>
          <div className="space-y-1.5 text-left">
            <FieldLabel>Don&apos;t show</FieldLabel>
            <CheckboxField
              id="search-exclude-shortlisted"
              label="Shortlisted profiles"
              hint="Hide members already in your shortlist."
              checked={filters.excludeShortlisted === 'true'}
              onChange={setFlag('excludeShortlisted')}
            />
          </div>
        </Section>

        {/* Match count footer: stays in view while scrolling the filters. */}
        <div className="sticky bottom-3 z-20 rounded-2xl border border-[#EADBBD] bg-white/95 backdrop-blur px-4 py-3 sm:px-5 shadow-[0_8px_30px_-6px_rgba(43,21,21,0.18)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs sm:text-sm font-semibold text-[#241C1A]" aria-live="polite" data-testid="match-count-footer">
            {countText}
          </p>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClear}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-white hover:bg-[#FAF7F2] active:scale-[0.99] text-[#4A3D36] border border-[#DECDBB] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[#5A4D45]" />
              <span>Clear</span>
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-[#7A1118] hover:bg-[#620D13] active:scale-[0.99] text-white shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              <span>{loading ? 'Searching…' : 'Search'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
