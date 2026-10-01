import { computeCompletionScore } from '../common/profile-completion.js';
import type { PrismaClient } from '../generated/prisma/client.js';

// One-off: recompute every stored completionScore from the profile's current
// fields and photo count (the score used to be 0 for every real member and a
// hardcoded 90 for demo members). Safe to re-run; only changed rows are written.
export async function backfillCompletionScores(
  prisma: PrismaClient,
  log: (message: string) => void = console.log,
): Promise<{ checked: number; updated: number }> {
  const profiles = await prisma.profile.findMany({ include: { _count: { select: { photos: true } } } });
  let updated = 0;
  for (const profile of profiles) {
    const completionScore = computeCompletionScore(profile, profile._count.photos);
    if (completionScore !== profile.completionScore) {
      await prisma.profile.update({ where: { id: profile.id }, data: { completionScore } });
      updated += 1;
    }
  }
  log(`Completion scores: ${profiles.length} profiles checked, ${updated} updated.`);
  return { checked: profiles.length, updated };
}
