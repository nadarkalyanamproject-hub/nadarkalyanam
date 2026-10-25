'use client';

import { DIETS, HABIT_FREQUENCIES } from '@nadar-kalyanam/schemas';
import { Select } from '@nadar-kalyanam/ui';
import { hasLifestyleFilters, type LifestyleFilters as Filters } from '../../lib/search-plan';

// Diet and smoking filters on Search. Their values live in the URL
// (?diet=…&smoking=…) like the preferences toggle, so they survive refresh
// and Back and combine with any category.
export function LifestyleFilters({ value, onChange }: { value: Filters; onChange: (next: Filters) => void }) {
  const select = (key: keyof Filters, label: string, options: readonly string[]) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold text-nk-muted">
      {label}
      <Select
        value={value[key]}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
        data-testid={`lifestyle-filter-${key}`}
      >
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </label>
  );

  return (
    <div className="rounded-2xl border border-nk-line-gold bg-white px-4 py-3 text-sm shadow-2xs" data-testid="lifestyle-filters">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-nk-ink">Lifestyle</p>
        {hasLifestyleFilters(value) && (
          <button
            type="button"
            onClick={() => onChange({ diet: '', smoking: '' })}
            className="text-xs font-semibold text-nk-maroon hover:underline"
          >
            Clear
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        {select('diet', 'Diet', DIETS)}
        {select('smoking', 'Smoking', HABIT_FREQUENCIES)}
      </div>
    </div>
  );
}
