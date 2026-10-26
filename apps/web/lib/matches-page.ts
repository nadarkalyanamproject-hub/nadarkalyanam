import type { Connection, MatchResult } from '@nadar-kalyanam/schemas';
import type { MatchProfileCardData } from '../components/matches/match-profile-card';

// A connected member as a Matches card. Only real stored details: a blank
// city, state or profession is left out rather than shown empty.
export function connectionCard(connection: Connection): MatchProfileCardData {
  return {
    profileId: connection.id,
    fullName: connection.fullName,
    age: connection.age,
    city: connection.location.city || null,
    state: connection.location.state || null,
    educationLevel: null,
    profession: connection.profession || null,
    primaryPhotoUrl: connection.primaryPhotoUrl,
    relationshipStatus: connection.relationshipStatus,
    conversationId: connection.conversationId,
  };
}

// "Your Top Matches": the best-ranked matches, leaving out connected
// members (they have their own section, so nobody appears twice). Filters
// first, then takes the top `count`, so the row stays full when it can.
export function topMatchCards(matches: readonly MatchResult[], count: number): MatchProfileCardData[] {
  return matches
    .filter((match) => match.relationshipStatus !== 'CONNECTED')
    .slice(0, count)
    .map((match) => ({
      profileId: match.profileId,
      fullName: match.fullName,
      age: match.age,
      city: match.city,
      state: null,
      educationLevel: null,
      profession: match.profession,
      primaryPhotoUrl: match.primaryPhotoUrl,
      relationshipStatus: match.relationshipStatus,
      conversationId: match.conversationId,
      score: match.score,
    }));
}
