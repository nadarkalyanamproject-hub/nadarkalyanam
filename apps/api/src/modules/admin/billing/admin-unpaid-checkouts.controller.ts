import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { parseOffsetLimit } from '../../../common/pagination.js';
import { PERMISSIONS } from '../../../common/permissions.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RequirePermission } from '../decorators/require-permission.decorator.js';
import { AdminAuthGuard } from '../guards/admin-auth.guard.js';
import { PermissionsGuard } from '../guards/permissions.guard.js';
import { buildUnpaidCheckouts, UNPAID_CHECKOUT_AFTER_MS, UNPAID_ORDER_STATUSES } from './unpaid-checkouts.js';

// How far back unpaid attempts are looked at. Older drop-offs are no longer
// worth a follow-up call, and this keeps the query bounded.
export const UNPAID_CHECKOUT_LOOKBACK_DAYS = 180;
const KINDS = ['MEMBERSHIP', 'HOROSCOPE_MATCH'] as const;

// Members who reached the payment window and did not pay within two days,
// as their own list for follow-up (finance.dashboard.view, like Orders).
@Controller('admin')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminUnpaidCheckoutsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('unpaid-checkouts')
  @RequirePermission(PERMISSIONS.FINANCE_DASHBOARD_VIEW)
  async list(
    @Query('kind') kind?: string,
    @Query('q') q?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    const now = new Date();
    const page = parseOffsetLimit(offset, limit, 50);
    const kindFilter = KINDS.find((k) => k === kind);
    const since = new Date(now.getTime() - UNPAID_CHECKOUT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

    const unpaidOrders = await this.prisma.order.findMany({
      where: {
        status: { in: [...UNPAID_ORDER_STATUSES] },
        createdAt: { gte: since },
        ...(kindFilter ? { kind: kindFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { name: true } }, matchProfile: { select: { fullName: true } } },
    });
    const userIds = [...new Set(unpaidOrders.map((o) => o.userId))];
    const paidOrders = userIds.length
      ? await this.prisma.order.findMany({
          where: { userId: { in: userIds }, status: 'PAID', createdAt: { gte: since } },
          select: { userId: true, kind: true, createdAt: true },
        })
      : [];

    const all = buildUnpaidCheckouts(
      unpaidOrders.map((o) => ({
        id: o.id,
        userId: o.userId,
        kind: o.kind,
        status: o.status,
        amountInPaise: o.amountInPaise,
        createdAt: o.createdAt,
        wanted:
          o.kind === 'HOROSCOPE_MATCH'
            ? `Porutham report${o.matchProfile?.fullName ? ` with ${o.matchProfile.fullName}` : ''}`
            : (o.plan?.name ?? 'Membership plan'),
      })),
      paidOrders,
      now,
    );

    const rowUserIds = [...new Set(all.map((r) => r.userId))];
    const [users, livePlans] = rowUserIds.length
      ? await Promise.all([
          this.prisma.user.findMany({
            where: { id: { in: rowUserIds } },
            select: { id: true, phoneNumber: true, status: true, profile: { select: { fullName: true } } },
          }),
          this.prisma.subscription.findMany({
            where: { userId: { in: rowUserIds }, cancelledAt: null, startedAt: { lte: now }, expiresAt: { gt: now } },
            select: { userId: true, plan: { select: { name: true } } },
          }),
        ])
      : [[], []];
    const userById = new Map(users.map((u) => [u.id, u]));
    const planByUser = new Map(livePlans.map((s) => [s.userId, s.plan.name]));

    const search = q?.trim().toLowerCase();
    const rows = all
      .map((r) => {
        const u = userById.get(r.userId);
        return {
          ...r,
          fullName: u?.profile?.fullName ?? null,
          phoneNumber: u?.phoneNumber ?? '',
          accountStatus: u?.status ?? 'DELETED',
          currentPlan: planByUser.get(r.userId) ?? null,
        };
      })
      // Anonymized accounts cannot be contacted.
      .filter((r) => r.accountStatus !== 'DELETED')
      .filter((r) => !search || (r.fullName ?? '').toLowerCase().includes(search) || r.phoneNumber.includes(search));

    return {
      afterHours: UNPAID_CHECKOUT_AFTER_MS / (60 * 60 * 1000),
      lookbackDays: UNPAID_CHECKOUT_LOOKBACK_DAYS,
      total: rows.length,
      totalValueInPaise: rows.reduce((sum, r) => sum + r.amountInPaise, 0),
      items: rows.slice(page.offset, page.offset + page.limit).map((r) => ({
        ...r,
        firstAttemptAt: r.firstAttemptAt.toISOString(),
        lastAttemptAt: r.lastAttemptAt.toISOString(),
      })),
    };
  }
}
