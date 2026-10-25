import 'package:flutter/material.dart';

// The Search page's categories (apps/web/lib/search-categories.ts). Real
// ones load members from their own endpoint; coming-soon ones say what
// data doesn't exist yet and never show results.
class SearchCategory {
  const SearchCategory({
    required this.slug,
    required this.group,
    required this.title,
    required this.subtitle,
    required this.icon,
    this.source,
    this.description,
    this.emptyMessage,
    this.comingSoon,
  });

  final String slug;
  final String group;
  final String title;
  final String subtitle;
  final IconData icon;
  // shortlisted-by-you | shortlisted-you | viewed-me | viewed-by-me |
  // newly-joined | nearby | with-photos | matches | location-preference
  final String? source;
  final String? description;
  final String? emptyMessage;
  // Set for categories that aren't built yet: why, in plain words.
  final String? comingSoon;
}

const categoryGroups = {'activity': 'Activity', 'profile': 'Profile', 'preferences': 'Preferences'};

const searchCategories = [
  SearchCategory(
    slug: 'shortlisted-by-you',
    group: 'activity',
    icon: Icons.bookmark_border_rounded,
    source: 'shortlisted-by-you',
    title: 'Shortlisted by you',
    subtitle: 'Members you have shortlisted',
    description: 'Members you have shortlisted, most recent first.',
    emptyMessage: "You haven't shortlisted anyone yet. Open a member's profile and tap Shortlist to save them here.",
  ),
  SearchCategory(
    slug: 'viewed-you',
    group: 'activity',
    icon: Icons.visibility_outlined,
    source: 'viewed-me',
    title: 'Viewed you',
    subtitle: 'Members who viewed your profile',
    description: 'Members who opened your profile, most recent first. Each member is listed once.',
    emptyMessage: 'No one has viewed your profile yet.',
  ),
  SearchCategory(
    slug: 'shortlisted-you',
    group: 'activity',
    icon: Icons.bookmark_added_outlined,
    source: 'shortlisted-you',
    title: 'Shortlisted you',
    subtitle: 'Members who shortlisted you',
    description: 'Members who added you to their shortlist, most recent first.',
    emptyMessage: 'No one has shortlisted your profile yet.',
  ),
  SearchCategory(
    slug: 'viewed-by-you',
    group: 'activity',
    icon: Icons.history_rounded,
    source: 'viewed-by-me',
    title: 'Viewed by you',
    subtitle: 'Profiles you have viewed',
    description: 'Profiles you have opened, most recent first. Each member is listed once.',
    emptyMessage: "You haven't viewed any profiles yet.",
  ),
  SearchCategory(
    slug: 'newly-joined',
    group: 'profile',
    icon: Icons.fiber_new_outlined,
    source: 'newly-joined',
    title: 'Newly joined',
    subtitle: 'Joined in the last 30 days',
    description: 'Members who joined in the last 30 days, newest first.',
    emptyMessage: 'No new members have joined in the last 30 days.',
  ),
  SearchCategory(
    slug: 'nearby',
    group: 'profile',
    icon: Icons.place_outlined,
    source: 'nearby',
    title: 'Nearby matches',
    subtitle: 'Near your location',
    description: 'Members in your city first, then elsewhere in your state (based on the location in your profile).',
    emptyMessage: 'No members share your city or state yet.',
  ),
  SearchCategory(
    slug: 'with-photos',
    group: 'profile',
    icon: Icons.photo_outlined,
    source: 'with-photos',
    title: 'Matches with photos',
    subtitle: 'Members who added photos',
    description: 'Members who have added at least one photo, newest first.',
    emptyMessage: 'No members with photos yet.',
  ),
  SearchCategory(
    slug: 'nri-matches',
    group: 'profile',
    icon: Icons.flight_outlined,
    title: 'NRI matches',
    subtitle: 'Members living outside India',
    comingSoon:
        "NRI matches aren't available yet. Country is fixed to India when a profile is created, so every member is listed as living in India and there's no one to show here.",
  ),
  SearchCategory(
    slug: 'your-matches',
    group: 'preferences',
    icon: Icons.favorite_border_rounded,
    source: 'matches',
    title: 'Your matches',
    subtitle: 'Ranked by your partner preferences',
    description: 'Members ranked by our matching engine for your profile and partner preferences, best match first.',
    emptyMessage: 'No matches are available for your profile right now. Check back as new members join.',
  ),
  SearchCategory(
    slug: 'location-preference',
    group: 'preferences',
    icon: Icons.map_outlined,
    source: 'location-preference',
    title: 'City/Location preference',
    subtitle: 'In your preferred states and cities',
    description: 'Members living in the states or cities you chose in your partner preferences.',
    emptyMessage: 'No members live in your preferred states or cities yet.',
  ),
  SearchCategory(
    slug: 'education-preference',
    group: 'preferences',
    icon: Icons.school_outlined,
    title: 'Education preference',
    subtitle: 'Your preferred education',
    comingSoon:
        "Partner preferences don't include education yet: education is free text on profiles, with no fixed list to choose a preference from.",
  ),
  SearchCategory(
    slug: 'professional-preference',
    group: 'preferences',
    icon: Icons.work_outline_rounded,
    title: 'Professional preference',
    subtitle: 'Your preferred profession',
    comingSoon:
        "Partner preferences don't include profession yet: occupation is free text on profiles, with no fixed list to choose a preference from.",
  ),
  SearchCategory(
    slug: 'mutual-matches',
    group: 'preferences',
    icon: Icons.people_outline_rounded,
    title: 'Mutual matches',
    subtitle: "You fit each other's preferences",
    comingSoon:
        "Mutual matching isn't built yet. It needs to check both your preferences and theirs at once, and the matching engine only ranks by yours today.",
  ),
  SearchCategory(
    slug: 'star-matches',
    group: 'preferences',
    icon: Icons.star_border_rounded,
    title: 'Star matches',
    subtitle: 'Compatible birth star',
    comingSoon:
        "Star matching isn't available yet. Horoscope details are private unless each member chooses to share them, and there's no star compatibility check yet.",
  ),
  SearchCategory(
    slug: 'horoscope-matches',
    group: 'preferences',
    icon: Icons.grid_view_rounded,
    title: 'Horoscope matches',
    subtitle: 'Horoscope matching yours',
    comingSoon:
        "Horoscope matching (porutham) isn't available yet. Members can add their own horoscope, but nothing compares two horoscopes yet.",
  ),
];

SearchCategory? findCategory(String slug) {
  for (final c in searchCategories) {
    if (c.slug == slug) return c;
  }
  return null;
}
