import { pickDailyRecommendations } from './daily-picks';

// How the home page splits the member's ranked matches between "Recommended
// Matches For You" (the top of the ranking) and "Daily Recommendations".
// The API keeps connected members in the ranking (the Matches page labels
// them "Connected"), but they're no recommendation any more, so the home
// page drops them first and then takes the top, keeping both rows full.
export function splitHomeMatches<T extends { profileId: string; relationshipStatus: string }>(
  matches: readonly T[],
  options: { userId: string; recommendedCount: number; dailyCount: number; now?: Date },
): { recommended: T[]; dailyPicks: T[] } {
  const candidates = matches.filter((match) => match.relationshipStatus !== 'CONNECTED');
  const recommended = candidates.slice(0, options.recommendedCount);
  const dailyPicks = pickDailyRecommendations(candidates, {
    userId: options.userId,
    count: options.dailyCount,
    exclude: new Set(recommended.map((match) => match.profileId)),
    now: options.now,
  });
  return { recommended, dailyPicks };
}
