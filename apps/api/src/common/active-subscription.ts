import type { MembershipPlan, Prisma, Subscription } from '../generated/prisma/client.js';
import type { PrismaService } from '../modules/prisma/prisma.service.js';

type Db = PrismaService | Prisma.TransactionClient;

export type SubscriptionWithPlan = Subscription & { plan: MembershipPlan };

// The member's subscription running right now, by dates: startedAt <= now <
// expiresAt and not cancelled (refunded), whatever the status column says.
// Also returns the end of the last already-paid renewal. Shared by
// EntitlementsService and recomputeSearchBoost (and usable inside a
// transaction).
export async function findActiveSubscription(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<{ current: SubscriptionWithPlan; paidThroughAt: Date } | null> {
  const live = await db.subscription.findMany({
    where: { userId, cancelledAt: null, expiresAt: { gt: now } },
    include: { plan: true },
    orderBy: { startedAt: 'asc' },
  });
  const current = live.find((subscription) => subscription.startedAt <= now);
  if (!current) return null;
  const paidThroughAt = live.reduce((latest, s) => (s.expiresAt > latest ? s.expiresAt : latest), current.expiresAt);
  return { current, paidThroughAt };
}
