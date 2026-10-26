import type { RelationshipStatus } from '@nadar-kalyanam/schemas';
import { listMatchCategory, listMatches, listNearbyMatches, listShortlistedMe, listShortlists } from './api-client';
import { mustHaveNotice } from './partner-preferences';
import type { CategorySource } from './search-categories';

// One member in a results list: the fields ResultCard shows. Every list the
// Search page loads (category endpoints, the matching engine, Search
// itself) returns at least these.
export interface ResultItem {
  profileId: string;
  fullName: string;
  age: number;
  city: string | null;
  primaryPhotoUrl: string | null;
  isVerified: boolean;
  relationshipStatus: RelationshipStatus;
  conversationId: string | null;
}

export interface LoadedCategory {
  items: ResultItem[];
  // Replaces the generic empty message when the reason is more specific.
  emptyNote?: string;
  // Extra context shown above the list (e.g. which location "nearby" used).
  basisNote?: string;
  // Must-have partner preferences are holding members back: offer a way to relax them.
  relaxLink?: boolean;
}

// Keeps just the ResultCard fields from any member list item.
export const toResultItem = ({ profileId, fullName, age, city, primaryPhotoUrl, isVerified, relationshipStatus, conversationId }: ResultItem): ResultItem => ({
  profileId,
  fullName,
  age,
  city,
  primaryPhotoUrl,
  isVerified,
  relationshipStatus,
  conversationId,
});

// One real endpoint per category; no category is a client-side filter over
// another list. (The preference-based category runs through Search instead.)
export async function loadCategory(
  accessToken: string,
  source: Exclude<CategorySource, 'location-preference'>,
): Promise<LoadedCategory> {
  switch (source) {
    case 'matches': {
      const { items, preferences } = await listMatches(accessToken, 50);
      const notice = mustHaveNotice(preferences, items.length);
      return {
        items: items.map(toResultItem),
        emptyNote: items.length === 0 && notice ? notice : undefined,
        basisNote: items.length > 0 && notice ? notice : undefined,
        relaxLink: Boolean(notice),
      };
    }
    case 'shortlisted-by-you':
      return { items: (await listShortlists(accessToken)).items.map(toResultItem) };
    case 'shortlisted-you':
      return { items: (await listShortlistedMe(accessToken)).items.map(toResultItem) };
    case 'nearby': {
      const result = await listNearbyMatches(accessToken);
      const place = [result.city, result.state].filter(Boolean).join(', ');
      return {
        items: result.items.map(toResultItem),
        basisNote: place ? `Using the location in your profile: ${place}.` : undefined,
        emptyNote: place ? undefined : 'Your profile has no city or state yet. Add your location to your profile to see nearby matches.',
      };
    }
    default:
      return { items: (await listMatchCategory(accessToken, source)).items.map(toResultItem) };
  }
}
