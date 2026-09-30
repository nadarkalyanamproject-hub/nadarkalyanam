// The 17 Matches-page categories. Each has its own page at
// /matches/<slug>. "real" categories load real members from a dedicated
// endpoint; "coming-soon" ones explain exactly which data doesn't exist yet
// — they never show placeholder or search-looking results.

export type RealCategorySource =
  | 'matches' // GET /matches (the matching engine)
  | 'shortlisted-by-you' // GET /shortlists
  | 'shortlisted-you' // GET /shortlists/shortlisted-me
  | 'viewed-me' // GET /match-categories/viewed-me
  | 'viewed-by-me' // GET /match-categories/viewed-by-me
  | 'newly-joined' // GET /match-categories/newly-joined
  | 'nearby' // GET /match-categories/nearby
  | 'with-photos'; // GET /match-categories/with-photos

interface BaseCategory {
  slug: string;
  title: string;
  subtitle: string;
}

export interface RealCategory extends BaseCategory {
  kind: 'real';
  source: RealCategorySource;
  // What this page lists, in a sentence (shown under the title).
  description: string;
  // Shown when the real list is empty.
  emptyMessage: string;
}

export interface ComingSoonCategory extends BaseCategory {
  kind: 'coming-soon';
  // The specific missing data, in plain words.
  message: string;
  // Optional honest alternative the member can use today.
  alternative?: { label: string; href: string };
}

export type MatchCategory = RealCategory | ComingSoonCategory;

export const MATCH_CATEGORIES: MatchCategory[] = [
  {
    slug: 'your-matches',
    kind: 'real',
    source: 'matches',
    title: 'Your Matches',
    subtitle: 'View all the profiles that match your preferences',
    description: 'Members ranked by our matching engine for your profile, best match first.',
    emptyMessage: 'No matches are available for your profile right now. Check back as new members join.',
  },
  {
    slug: 'shortlisted-by-you',
    kind: 'real',
    source: 'shortlisted-by-you',
    title: 'Shortlisted by you',
    subtitle: 'Matches you have shortlisted',
    description: 'Members you have shortlisted, most recent first.',
    emptyMessage: "You haven't shortlisted anyone yet. Open a member's profile and tap Shortlist to save them here.",
  },
  {
    slug: 'viewed-you',
    kind: 'real',
    source: 'viewed-me',
    title: 'Viewed you',
    subtitle: 'Matches who have viewed your profile',
    description: 'Members who opened your profile, most recent first. Each member is listed once.',
    emptyMessage: 'No one has viewed your profile yet.',
  },
  {
    slug: 'shortlisted-you',
    kind: 'real',
    source: 'shortlisted-you',
    title: 'Shortlisted you',
    subtitle: 'Matches who have shortlisted your profile',
    description: 'Members who added you to their shortlist, most recent first.',
    emptyMessage: 'No one has shortlisted your profile yet.',
  },
  {
    slug: 'viewed-by-you',
    kind: 'real',
    source: 'viewed-by-me',
    title: 'Viewed by you',
    subtitle: 'Matches you have viewed',
    description: 'Profiles you have opened, most recent first. Each member is listed once.',
    emptyMessage: "You haven't viewed any profiles yet.",
  },
  {
    slug: 'newly-joined',
    kind: 'real',
    source: 'newly-joined',
    title: 'Newly Joined',
    subtitle: 'Matches who joined within the last 30 days',
    description: 'Members who joined in the last 30 days, newest first.',
    emptyMessage: 'No new members have joined in the last 30 days.',
  },
  {
    slug: 'nearby',
    kind: 'real',
    source: 'nearby',
    title: 'Nearby matches',
    subtitle: 'Matches near your location',
    description: 'Members in your city first, then elsewhere in your state (based on the location in your profile).',
    emptyMessage: 'No members share your city or state yet.',
  },
  {
    slug: 'with-photos',
    kind: 'real',
    source: 'with-photos',
    title: 'Matches with photos',
    subtitle: 'Matches that have added photos',
    description: 'Members who have added at least one photo, newest first.',
    emptyMessage: 'No members with photos yet.',
  },
  {
    slug: 'with-horoscope',
    kind: 'coming-soon',
    title: 'Matches with horoscope',
    subtitle: 'Matches that have added horoscope',
    message:
      "Horoscopes can't be added to profiles yet. Profile creation only asks whether a member has dosham — it doesn't collect a horoscope, birth chart, star or raasi — so there are no horoscopes to show.",
  },
  {
    slug: 'star-matches',
    kind: 'coming-soon',
    title: 'Star matches',
    subtitle: 'Matches with compatible star sign',
    message:
      "Star matching isn't available yet. We don't ask for your birth star (nakshatra) or raasi during profile creation, so there's nothing to compare yours against.",
  },
  {
    slug: 'horoscope-matches',
    kind: 'coming-soon',
    title: 'Horoscope matches',
    subtitle: 'Matches with horoscope matching yours',
    message:
      "Horoscope matching (porutham) isn't available yet. It needs each member's birth date, time and place, and we don't collect birth time, birth place or horoscope details yet.",
  },
  {
    slug: 'mutual-matches',
    kind: 'coming-soon',
    title: 'Mutual matches',
    subtitle: 'Matches whose profile match your preferences and vice versa',
    message:
      "Mutual matches need partner preferences from both sides — what you're looking for and what they're looking for. Partner preferences aren't collected yet, so neither direction can be checked.",
  },
  {
    slug: 'looking-for-you',
    kind: 'coming-soon',
    title: 'Looking for you',
    subtitle: 'Matches whose preferences match your profile',
    message:
      "Partner preferences aren't collected yet, so we can't show who's looking for someone like you.",
  },
  {
    slug: 'education-preference',
    kind: 'coming-soon',
    title: 'Education preference',
    subtitle: 'Matches based on your preferred education',
    message:
      "You can't set a preferred education for your partner yet — partner preferences aren't part of profiles yet, so there's no preference to match against.",
    alternative: { label: 'Search by education instead', href: '/search' },
  },
  {
    slug: 'professional-preference',
    kind: 'coming-soon',
    title: 'Professional preference',
    subtitle: 'Matches based on your preferred profession',
    message:
      "You can't set a preferred profession for your partner yet — partner preferences aren't part of profiles yet, so there's no preference to match against.",
    alternative: { label: 'Search by profession instead', href: '/search' },
  },
  {
    slug: 'location-preference',
    kind: 'coming-soon',
    title: 'City/location preference',
    subtitle: 'Matches based on your preferred city/location',
    message:
      "You can't set a preferred city or location for your partner yet — partner preferences aren't part of profiles yet. (Nearby matches, based on your own city and state, is available.)",
    alternative: { label: 'See nearby matches', href: '/matches/nearby' },
  },
  {
    slug: 'nri-matches',
    kind: 'coming-soon',
    title: 'NRI matches',
    subtitle: 'Matches from outside India',
    message:
      "NRI matches aren't available yet. Country is fixed to India when a profile is created, so every member is currently listed as living in India and there's no one to show here.",
  },
];

export function findMatchCategory(slug: string): MatchCategory | undefined {
  return MATCH_CATEGORIES.find((category) => category.slug === slug);
}

export function matchCategoryHref(slug: string): string {
  if (!findMatchCategory(slug)) throw new Error(`Unknown match category: ${slug}`);
  return `/matches/${slug}`;
}
