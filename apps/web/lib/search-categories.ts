// The categories on the Search page (/search?category=<slug>). "real" ones
// load real members from an existing endpoint; "coming-soon" ones say
// exactly which data doesn't exist yet and never show results.

export type CategorySource =
  | 'matches' // GET /matches (the matching engine, ranked by partner preferences)
  | 'shortlisted-by-you' // GET /shortlists
  | 'shortlisted-you' // GET /shortlists/shortlisted-me
  | 'viewed-me' // GET /match-categories/viewed-me
  | 'viewed-by-me' // GET /match-categories/viewed-by-me
  | 'newly-joined' // GET /match-categories/newly-joined
  | 'nearby' // GET /match-categories/nearby
  | 'with-photos' // GET /match-categories/with-photos
  | 'location-preference'; // GET /search/profiles with the saved preferred states/cities

export type CategoryGroup = 'activity' | 'profile' | 'preferences';

export const CATEGORY_GROUPS: { key: CategoryGroup; title: string }[] = [
  { key: 'activity', title: 'Activity' },
  { key: 'profile', title: 'Profile' },
  { key: 'preferences', title: 'Preferences' },
];

interface BaseCategory {
  slug: string;
  title: string;
  subtitle: string;
  group: CategoryGroup;
}

// How a real category combines with "Use my partner preferences".
//  - 'search': it's also a Search filter, so preferences narrow it down.
//  - 'built-in': it's already based on the saved preferences.
//  - 'own-rules': it's a fixed list (who viewed / shortlisted); preferences don't apply.
export type PreferenceMode = 'search' | 'built-in' | 'own-rules';

export interface RealCategory extends BaseCategory {
  kind: 'real';
  source: CategorySource;
  preferenceMode: PreferenceMode;
  // What the list shows, in a sentence.
  description: string;
  // Shown when the real list is empty.
  emptyMessage: string;
}

export interface ComingSoonCategory extends BaseCategory {
  kind: 'coming-soon';
  // The specific missing data, in plain words.
  message: string;
}

export type SearchCategory = RealCategory | ComingSoonCategory;

export const SEARCH_CATEGORIES: SearchCategory[] = [
  // Activity
  {
    slug: 'shortlisted-by-you',
    group: 'activity',
    kind: 'real',
    source: 'shortlisted-by-you',
    preferenceMode: 'own-rules',
    title: 'Shortlisted by you',
    subtitle: 'Members you have shortlisted',
    description: 'Members you have shortlisted, most recent first.',
    emptyMessage: "You haven't shortlisted anyone yet. Open a member's profile and tap Shortlist to save them here.",
  },
  {
    slug: 'viewed-you',
    group: 'activity',
    kind: 'real',
    source: 'viewed-me',
    preferenceMode: 'own-rules',
    title: 'Viewed you',
    subtitle: 'Members who viewed your profile',
    description: 'Members who opened your profile, most recent first. Each member is listed once.',
    emptyMessage: 'No one has viewed your profile yet.',
  },
  {
    slug: 'shortlisted-you',
    group: 'activity',
    kind: 'real',
    source: 'shortlisted-you',
    preferenceMode: 'own-rules',
    title: 'Shortlisted you',
    subtitle: 'Members who shortlisted you',
    description: 'Members who added you to their shortlist, most recent first.',
    emptyMessage: 'No one has shortlisted your profile yet.',
  },
  {
    slug: 'viewed-by-you',
    group: 'activity',
    kind: 'real',
    source: 'viewed-by-me',
    preferenceMode: 'own-rules',
    title: 'Viewed by you',
    subtitle: 'Profiles you have viewed',
    description: 'Profiles you have opened, most recent first. Each member is listed once.',
    emptyMessage: "You haven't viewed any profiles yet.",
  },
  // Profile
  {
    slug: 'newly-joined',
    group: 'profile',
    kind: 'real',
    source: 'newly-joined',
    preferenceMode: 'search',
    title: 'Newly Joined',
    subtitle: 'Joined in the last 30 days',
    description: 'Members who joined in the last 30 days, newest first.',
    emptyMessage: 'No new members have joined in the last 30 days.',
  },
  {
    slug: 'nearby',
    group: 'profile',
    kind: 'real',
    source: 'nearby',
    preferenceMode: 'search',
    title: 'Nearby matches',
    subtitle: 'Near your location',
    description: 'Members in your city first, then elsewhere in your state (based on the location in your profile).',
    emptyMessage: 'No members share your city or state yet.',
  },
  {
    slug: 'with-photos',
    group: 'profile',
    kind: 'real',
    source: 'with-photos',
    preferenceMode: 'search',
    title: 'Matches with photos',
    subtitle: 'Members who added photos',
    description: 'Members who have added at least one photo, newest first.',
    emptyMessage: 'No members with photos yet.',
  },
  {
    slug: 'nri-matches',
    group: 'profile',
    kind: 'coming-soon',
    title: 'NRI matches',
    subtitle: 'Members living outside India',
    message:
      "NRI matches aren't available yet. Country is fixed to India when a profile is created, so every member is listed as living in India and there's no one to show here.",
  },
  // Preferences
  {
    slug: 'your-matches',
    group: 'preferences',
    kind: 'real',
    source: 'matches',
    preferenceMode: 'built-in',
    title: 'Your Matches',
    subtitle: 'Ranked by your partner preferences',
    description: 'Members ranked by our matching engine for your profile and partner preferences, best match first.',
    emptyMessage: 'No matches are available for your profile right now. Check back as new members join.',
  },
  {
    slug: 'location-preference',
    group: 'preferences',
    kind: 'real',
    source: 'location-preference',
    preferenceMode: 'built-in',
    title: 'City/Location preference',
    subtitle: 'In your preferred states and cities',
    description: 'Members living in the states or cities you chose in your partner preferences.',
    emptyMessage: 'No members live in your preferred states or cities yet.',
  },
  {
    slug: 'education-preference',
    group: 'preferences',
    kind: 'coming-soon',
    title: 'Education preference',
    subtitle: 'Your preferred education',
    message:
      "Partner preferences don't include education yet: education is free text on profiles, with no fixed list to choose a preference from.",
  },
  {
    slug: 'professional-preference',
    group: 'preferences',
    kind: 'coming-soon',
    title: 'Professional preference',
    subtitle: 'Your preferred profession',
    message:
      "Partner preferences don't include profession yet: occupation is free text on profiles, with no fixed list to choose a preference from.",
  },
  {
    slug: 'mutual-matches',
    group: 'preferences',
    kind: 'coming-soon',
    title: 'Mutual matches',
    subtitle: 'You fit each other’s preferences',
    message:
      "Mutual matching isn't built yet. It needs to check both your preferences and theirs at once, and the matching engine only ranks by yours today.",
  },
  {
    slug: 'star-matches',
    group: 'preferences',
    kind: 'coming-soon',
    title: 'Star matches',
    subtitle: 'Compatible birth star',
    message:
      "Star matching isn't available yet. Horoscope details are private unless each member chooses to share them, and there's no star compatibility check yet.",
  },
  {
    slug: 'horoscope-matches',
    group: 'preferences',
    kind: 'coming-soon',
    title: 'Horoscope matches',
    subtitle: 'Horoscope matching yours',
    message:
      "Horoscope matching (porutham) isn't available yet. Members can add their own horoscope, but nothing compares two horoscopes yet.",
  },
];

export function findSearchCategory(slug: string | null | undefined): SearchCategory | undefined {
  return slug ? SEARCH_CATEGORIES.find((category) => category.slug === slug) : undefined;
}

export function searchCategoryHref(slug: string): string {
  if (!findSearchCategory(slug)) throw new Error(`Unknown search category: ${slug}`);
  return `/search?category=${slug}`;
}

// The Search page's URL for a category and the preferences toggle.
export function searchHref({ category, usePreferences }: { category: string | null; usePreferences: boolean }): string {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (usePreferences) params.set('prefs', '1');
  const qs = params.toString();
  return qs ? `/search?${qs}` : '/search';
}

// Where the partner-preferences editor lives (the Profile page opens and
// scrolls to this section when the link carries its anchor).
export const PREFERENCES_EDITOR_HREF = '/profile#section-preferences';
