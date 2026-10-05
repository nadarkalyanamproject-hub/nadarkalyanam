import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../modules/prisma/prisma.service.js';
import { findActiveSubscription } from './active-subscription.js';

type Db = PrismaService | Prisma.TransactionClient;

// Priority listing, all in one place.
// Tier per plan code: 0 standard (no plan, Gold), 1 priority (Gold Plus),
// 2 spotlight (Gold Premium, VIP Assisted). The one-time SQL backfill in the
// 20261006090000 migration mirrors this table.
export const PLAN_SEARCH_BOOST: Record<string, number> = {
  GOLD: 0,
  GOLD_PLUS: 1,
  GOLD_PREMIUM: 2,
  VIP_ASSISTED: 2,
};

// Matches: a small score bonus per tier, added to the existing compatibility
// score (max ~100). Priority is smaller than spotlight; both are small enough
// that compatibility still dominates.
export const MATCH_SCORE_BOOST: Record<number, number> = { 0: 0, 1: 3, 2: 6 };

// Search's default order is (searchBoost desc, id asc). Its cursor carries
// both ("<boost>:<id>") so the next page starts strictly after that position
// even if that profile's tier has changed since; the old id-only cursor is
// still accepted (its current tier is looked up).
export function encodeSearchCursor(profile: { searchBoost: number; id: string }): string {
  return `${profile.searchBoost}:${profile.id}`;
}

export function parseSearchCursor(cursor: string): { boost: number; id: string } | { id: string } {
  const match = /^(\d+):(.+)$/.exec(cursor);
  return match ? { boost: Number(match[1]), id: match[2]! } : { id: cursor };
}

// Rows strictly after the cursor position in (searchBoost desc, id asc).
export function afterSearchCursor(position: { boost: number; id: string }): Prisma.ProfileWhereInput {
  return {
    OR: [{ searchBoost: { lt: position.boost } }, { searchBoost: position.boost, id: { gt: position.id } }],
  };
}

export function searchBoostForPlanCode(code: string | null | undefined): number {
  return code ? (PLAN_SEARCH_BOOST[code] ?? 0) : 0;
}

// Keeps profiles.searchBoost equal to the tier of the member's current plan.
// Called when a plan activates (inside the webhook transaction), when it is
// refunded, and by the expiry job for every subscription it expires. The
// expiry job runs every 15 minutes, so a lapsed boost can outlast the plan
// by up to 15 minutes.
export async function recomputeSearchBoost(db: Db, userId: string, now: Date = new Date()): Promise<number> {
  const active = await findActiveSubscription(db, userId, now);
  const boost = searchBoostForPlanCode(active?.current.plan.code);
  await db.profile.updateMany({ where: { userId, searchBoost: { not: boost } }, data: { searchBoost: boost } });
  return boost;
}
