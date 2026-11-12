'use client';

import { useState } from 'react';
import { DOSHAM_TYPES } from '@nadar-kalyanam/schemas';
import { Field, Input } from '@nadar-kalyanam/ui';
import { SmartDropdown, type SmartDropdownOption } from '../ui/smart-dropdown';

const POPULAR_DOSHAMS = [
  'Sevvai (Chevvai) Dosham',
  'Rahu-Ketu Dosham',
  'Naga Dosham',
  'Shani Dosham',
] as const;

const DOSHAM_TAGS: Record<string, string> = {
  'Sevvai (Chevvai) Dosham': 'Mars / Manglik',
  'Rahu Dosham': 'North Node',
  'Ketu Dosham': 'South Node',
  'Rahu-Ketu Dosham': 'Dual Node',
  'Kala Sarpa Dosham': 'Kala Sarpa',
  'Naga Dosham': 'Serpent affliction',
  'Shani Dosham': 'Saturn influence',
  'Pitru Dosham': 'Ancestral blessing',
  'Nadi Dosham': 'Nadi match',
  'Bhakoot Dosham': 'Moon sign distance',
  Other: 'Other dosham',
};

const DOSHAM_DROPDOWN_OPTIONS: SmartDropdownOption[] = DOSHAM_TYPES.map((d) => ({
  value: d,
  label: d,
  badge: DOSHAM_TAGS[d],
}));

const isKnownDosham = (v: string) => (DOSHAM_TYPES as readonly string[]).includes(v);

// Dosham type picker: the shared SmartDropdown (same look as every other
// dropdown in the form), quick-pick chips for the common ones, and a free
// text box when "Other" is chosen.
export function DoshamDetailsDropdown({
  value,
  onChange,
  error,
  label = 'Dosh details',
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
}) {
  const [customText, setCustomText] = useState(() => (value && !isKnownDosham(value) ? value : ''));
  const isOther = value === 'Other' || (Boolean(value) && !isKnownDosham(value));

  function handleSelect(dosham: string) {
    if (dosham === 'Other') {
      onChange(customText || 'Other');
    } else {
      onChange(dosham);
      setCustomText('');
    }
  }

  function handleCustomTextChange(text: string) {
    setCustomText(text);
    onChange(text.trim() ? text : 'Other');
  }

  return (
    <div className="flex flex-col gap-2">
      <Field label={label} htmlFor="doshamDetails" required error={error}>
        <SmartDropdown
          id="doshamDetails"
          invalid={Boolean(error)}
          value={isOther ? 'Other' : value}
          onChange={handleSelect}
          options={DOSHAM_DROPDOWN_OPTIONS}
          placeholder="Select dosham type"
          searchable
          searchPlaceholder="Search dosham type..."
        />
      </Field>

      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange('');
            setCustomText('');
          }}
          className="self-end text-xs text-nk-subtle transition-colors hover:text-[#8E1B24]"
        >
          Clear
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-nk-subtle">Quick pick:</span>
          {POPULAR_DOSHAMS.map((dosham) => (
            <button
              key={dosham}
              type="button"
              onClick={() => handleSelect(dosham)}
              className="inline-flex items-center rounded-full border border-[#EADBCA] bg-white px-2.5 py-1 text-xs font-medium text-nk-ink transition-colors duration-200 hover:border-[#D3C1B1] hover:bg-[rgba(142,27,36,0.07)] hover:text-[#8E1B24]"
            >
              {dosham.replace(' Dosham', '')}
            </button>
          ))}
        </div>
      )}

      {isOther && (
        <Input
          aria-label="Dosham name"
          placeholder="Please specify your dosham name..."
          value={customText}
          onChange={(e) => handleCustomTextChange(e.target.value)}
        />
      )}
    </div>
  );
}
