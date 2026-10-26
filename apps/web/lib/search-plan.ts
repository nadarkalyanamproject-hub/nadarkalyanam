import type { SavedPartnerPreferences } from '@nadar-kalyanam/schemas';
import { preferenceSummary, searchFiltersFromPreferences } from './partner-preferences';
import { EMPTY_SEARCH_FILTERS, type SearchFilters } from './search-query';
import { findSearchCategory, type CategorySource, type ComingSoonCategory, type RealCategory } from './search-categories';

// What the Search page loads for the chosen category and "Use my partner
// preferences" toggle (both from the URL). Pure, so every combination is
// easy to test; the page only runs the plan.
export type SearchPlan =
  // Nothing chosen yet: just the category list.
  | { kind: 'idle' }
  // A category slug that doesn't exist (an old or mistyped link).
  | { kind: 'unknown'; slug: string }
  | { kind: 'coming-soon'; category: ComingSoonCategory }
  // Needs the saved preferences, which are still loading.
  | { kind: 'waiting-for-preferences' }
  // Needs saved preferences the member hasn't set.
  | { kind: 'needs-preferences'; missing: 'any' | 'location'; category: RealCategory | null }
  // A category's own endpoint.
  | { kind: 'endpoint'; category: RealCategory; source: Exclude<CategorySource, 'location-preference'>; note: string | null }
  // GET /search/profiles with these filters.
  | { kind: 'search'; category: RealCategory | null; filters: SearchFilters; note: string | null };

// undefined = still loading, null = none saved.
type Preferences = SavedPartnerPreferences | null | undefined;

export function hasSavedPreferences(preferences: Preferences): preferences is SavedPartnerPreferences {
  return Boolean(preferences && preferenceSummary(preferences).length > 0);
}

// The Search filter each search-mode category maps to.
const CATEGORY_FILTERS: Partial<Record<CategorySource, Partial<SearchFilters>>> = {
  'newly-joined': { joinedWithinDays: '30' },
  nearby: { nearby: 'true' },
  'with-photos': { withPhoto: 'true' },
};

const NOTES = {
  ownRules: "This list has its own rules (who viewed or shortlisted whom), so your partner preferences aren't applied to it.",
  builtIn: 'This list is already based on your partner preferences.',
  combined: 'Showing members in this category who also fit your partner preferences.',
};

export function planSearch({
  slug,
  usePreferences,
  preferences,
}: {
  slug: string | null;
  usePreferences: boolean;
  preferences: Preferences;
}): SearchPlan {
  const category = findSearchCategory(slug);
  if (slug && !category) return { kind: 'unknown', slug };

  const fromPreferences = (): SearchFilters | 'waiting' | 'none' => {
    if (preferences === undefined) return 'waiting';
    if (!hasSavedPreferences(preferences)) return 'none';
    return { ...EMPTY_SEARCH_FILTERS, ...searchFiltersFromPreferences(preferences) };
  };

  if (!category) {
    if (!usePreferences) return { kind: 'idle' };
    const filters = fromPreferences();
    if (filters === 'waiting') return { kind: 'waiting-for-preferences' };
    if (filters === 'none') return { kind: 'needs-preferences', missing: 'any', category: null };
    return { kind: 'search', category: null, filters, note: null };
  }

  if (category.kind === 'coming-soon') return { kind: 'coming-soon', category };

  if (category.source === 'location-preference') {
    if (preferences === undefined) return { kind: 'waiting-for-preferences' };
    if (!preferences || (preferences.states.length === 0 && preferences.cities.length === 0)) {
      return { kind: 'needs-preferences', missing: 'location', category };
    }
    const base = usePreferences ? fromPreferences() : EMPTY_SEARCH_FILTERS;
    const filters = typeof base === 'string' ? EMPTY_SEARCH_FILTERS : base;
    return {
      kind: 'search',
      category,
      filters: { ...filters, stateIn: preferences.states.join(','), cityIn: preferences.cities.join(',') },
      note: usePreferences ? NOTES.combined : null,
    };
  }

  const source = category.source;
  if (category.preferenceMode === 'search' && usePreferences) {
    const filters = fromPreferences();
    if (filters === 'waiting') return { kind: 'waiting-for-preferences' };
    if (filters === 'none') return { kind: 'needs-preferences', missing: 'any', category };
    return { kind: 'search', category, filters: { ...filters, ...CATEGORY_FILTERS[source] }, note: NOTES.combined };
  }

  const note = !usePreferences ? null : category.preferenceMode === 'own-rules' ? NOTES.ownRules : NOTES.builtIn;
  return { kind: 'endpoint', category, source, note };
}
