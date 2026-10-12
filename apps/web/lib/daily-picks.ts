// "Daily Recommendations" on the home page: a small set picked from the
// member's own matches, the same all day and different the next day (India
// time). Pure and deterministic, so every device shows the same picks.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The India-time calendar date, e.g. "2026-10-09". */
export function istDateKey(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// FNV-1a: a stable 32-bit hash of the seed string.
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32 finaliser: spreads a 32-bit seed evenly over [0, 1).
function seededRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Today's picks for one member: only people they haven't interacted with
 * yet, skipping anyone in `exclude` (already shown elsewhere on the page),
 * shuffled with a seed of member + India date, first `count` kept. Each
 * profile's place in the shuffle depends only on that seed and its own id,
 * so someone leaving the pool mid-day (e.g. after connecting) frees up one
 * slot instead of reshuffling everyone else.
 */
export function pickDailyRecommendations<T extends { profileId: string; relationshipStatus: string }>(
  pool: readonly T[],
  options: { userId: string; count: number; exclude?: ReadonlySet<string>; now?: Date },
): T[] {
  const seed = `${options.userId}:${istDateKey(options.now)}`;
  return pool
    .filter((item) => item.relationshipStatus === 'NONE' && !options.exclude?.has(item.profileId))
    .map((item) => ({ item, key: seededRandom(hashSeed(`${seed}:${item.profileId}`)) }))
    .sort((a, b) => a.key - b.key)
    .slice(0, options.count)
    .map(({ item }) => item);
}
