import { istDayStart } from '../../../common/ist-calendar.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

export interface FinanceDashboard {
  days: number;
  timezone: 'Asia/Kolkata';
  from: string;
  // Money in paise.
  grossRevenueInPaise: number;
  paidOrdersCount: number;
  refundedInPaise: number;
  refundedCount: number;
  netRevenueInPaise: number;
  ordersByStatus: Record<string, number>;
  activeSubscriptionsByPlan: { planCode: string; planName: string; count: number }[];
  expiringNext7Days: number;
  adminGrantsCount: number;
  adminGrantsWithPaymentReference: number;
  revenuePerDay: { date: string; grossInPaise: number }[];
}

const istDate = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

// Finance figures for the last `days` India-time days (today included).
// Definitions (shown on the page too):
//  - gross revenue: orders PAID in the range, including ones refunded later;
//  - refunded: orders refunded in the range; net = gross - refunded;
//  - admin grants are counted separately and never added to revenue (an
//    offline payment reference on a grant is not summed either);
//  - "active" plans use dates (running now, not cancelled).
export async function buildFinanceDashboard(prisma: PrismaService, days: number, now: Date = new Date()): Promise<FinanceDashboard> {
  const from = new Date(istDayStart(now).getTime() - (days - 1) * DAY_MS);
  const in7Days = new Date(now.getTime() + 7 * DAY_MS);
  const activeWhere = { cancelledAt: null, startedAt: { lte: now }, expiresAt: { gt: now } };

  const [paid, refunded, statusGroups, activeGroups, expiring, grants, grantsWithRef, plans] = await Promise.all([
    prisma.order.findMany({
      where: { paidAt: { gte: from }, status: { in: ['PAID', 'REFUNDED'] } },
      select: { amountInPaise: true, paidAt: true },
    }),
    prisma.order.aggregate({ where: { refundedAt: { gte: from }, status: 'REFUNDED' }, _sum: { amountInPaise: true }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ['status'], where: { createdAt: { gte: from } }, _count: { _all: true } }),
    prisma.subscription.groupBy({ by: ['planId'], where: activeWhere, _count: { _all: true } }),
    prisma.subscription.count({ where: { ...activeWhere, expiresAt: { gt: now, lte: in7Days } } }),
    prisma.subscription.count({ where: { source: 'ADMIN_GRANT', createdAt: { gte: from } } }),
    prisma.subscription.count({ where: { source: 'ADMIN_GRANT', createdAt: { gte: from }, paymentReference: { not: null } } }),
    prisma.membershipPlan.findMany({ select: { id: true, code: true, name: true, sortOrder: true } }),
  ]);

  const gross = paid.reduce((sum, order) => sum + order.amountInPaise, 0);
  const refundedInPaise = refunded._sum.amountInPaise ?? 0;

  const perDay = new Map<string, number>();
  for (let i = 0; i < days; i += 1) perDay.set(istDate(new Date(from.getTime() + i * DAY_MS)), 0);
  for (const order of paid) {
    const key = istDate(order.paidAt!);
    if (perDay.has(key)) perDay.set(key, perDay.get(key)! + order.amountInPaise);
  }

  const planById = new Map(plans.map((p) => [p.id, p]));
  return {
    days,
    timezone: 'Asia/Kolkata',
    from: from.toISOString(),
    grossRevenueInPaise: gross,
    paidOrdersCount: paid.length,
    refundedInPaise,
    refundedCount: refunded._count._all,
    netRevenueInPaise: gross - refundedInPaise,
    ordersByStatus: Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])),
    activeSubscriptionsByPlan: activeGroups
      .map((g) => ({ plan: planById.get(g.planId), count: g._count._all }))
      .sort((a, b) => (a.plan?.sortOrder ?? 0) - (b.plan?.sortOrder ?? 0))
      .map(({ plan, count }) => ({ planCode: plan?.code ?? 'UNKNOWN', planName: plan?.name ?? 'Unknown plan', count })),
    expiringNext7Days: expiring,
    adminGrantsCount: grants,
    adminGrantsWithPaymentReference: grantsWithRef,
    revenuePerDay: [...perDay.entries()].map(([date, grossInPaise]) => ({ date, grossInPaise })),
  };
}
