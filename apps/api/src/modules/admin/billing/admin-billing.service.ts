import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminOrdersQuery,
  AdminSubscriptionsQuery,
  GrantSubscriptionRequest,
  SubscriptionState,
  UpdatePlanRequest,
} from '@nadar-kalyanam/schemas';
import { istMonthWindow } from '../../../common/ist-calendar.js';
import type { Prisma, Subscription } from '../../../generated/prisma/client.js';
import { SubscriptionService } from '../../membership/subscription.service.js';
import { planFeatures } from '../../payments/payments.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../audit-log.service.js';

const IST_OFFSET_MS = 330 * 60 * 1000;
const STALE_CREATED_ORDER_MS = 30 * 60 * 1000;

export function subscriptionState(s: Pick<Subscription, 'cancelledAt' | 'startedAt' | 'expiresAt'>, now: Date): SubscriptionState {
  if (s.cancelledAt) return 'CANCELLED';
  if (s.expiresAt <= now) return 'EXPIRED';
  if (s.startedAt > now) return 'QUEUED';
  return 'ACTIVE';
}

export function subscriptionStateWhere(state: SubscriptionState, now: Date): Prisma.SubscriptionWhereInput {
  switch (state) {
    case 'CANCELLED':
      return { cancelledAt: { not: null } };
    case 'EXPIRED':
      return { cancelledAt: null, expiresAt: { lte: now } };
    case 'QUEUED':
      return { cancelledAt: null, startedAt: { gt: now } };
    case 'ACTIVE':
      return { cancelledAt: null, startedAt: { lte: now }, expiresAt: { gt: now } };
  }
}

// Member name or phone number (or an order id, for orders).
function memberSearch(search: string | undefined): Prisma.UserWhereInput | undefined {
  if (!search) return undefined;
  return {
    OR: [
      { phoneNumber: { contains: search } },
      { profile: { fullName: { contains: search, mode: 'insensitive' } } },
    ],
  };
}

// "2026-10-07" (IST) -> the UTC instant that day starts.
const istDateStart = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - IST_OFFSET_MS);

const memberSelect = { id: true, phoneNumber: true, status: true, profile: { select: { fullName: true } } } as const;
type MemberRow = { id: string; phoneNumber: string; status: string; profile: { fullName: string } | null };
const toMember = (u: MemberRow) => ({ userId: u.id, fullName: u.profile?.fullName ?? null, phoneNumber: u.phoneNumber, status: u.status });

@Injectable()
export class AdminBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async adminEmails(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map();
    const admins = await this.prisma.adminUser.findMany({ where: { id: { in: unique } }, select: { id: true, email: true } });
    return new Map(admins.map((a) => [a.id, a.email]));
  }

  // --- Plans --------------------------------------------------------------

  async listPlans() {
    const now = new Date();
    const [plans, active] = await Promise.all([
      this.prisma.membershipPlan.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
      this.prisma.subscription.groupBy({ by: ['planId'], where: subscriptionStateWhere('ACTIVE', now), _count: { _all: true } }),
    ]);
    const activeByPlan = new Map(active.map((g) => [g.planId, g._count._all]));
    return {
      items: plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        priceInPaise: p.priceInPaise,
        durationDays: p.durationDays,
        phoneUnlockLimit: p.phoneUnlockLimit,
        isAssisted: p.isAssisted,
        isActive: p.isActive,
        sortOrder: p.sortOrder,
        features: planFeatures(p.entitlements),
        activeSubscriptions: activeByPlan.get(p.id) ?? 0,
      })),
    };
  }

  // Name, price, active and order only. Existing orders keep the amount they
  // were created with; only new orders use the new price.
  async updatePlan(adminId: string, planId: string, change: UpdatePlanRequest) {
    const plan = await this.prisma.membershipPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    const keys = (Object.keys(change) as (keyof UpdatePlanRequest)[]).filter((k) => change[k] !== plan[k]);
    if (keys.length === 0) return (await this.listPlans()).items.find((p) => p.id === planId)!;
    const data = Object.fromEntries(keys.map((k) => [k, change[k]]));
    const before = Object.fromEntries(keys.map((k) => [k, plan[k]]));
    await this.prisma.membershipPlan.update({ where: { id: planId }, data });
    await this.auditLog.record(adminId, 'plan.update', 'MembershipPlan', planId, { code: plan.code, before, after: data });
    return (await this.listPlans()).items.find((p) => p.id === planId)!;
  }

  // --- Subscriptions --------------------------------------------------------

  private async toSubscriptionViews(
    rows: (Subscription & { plan: { id: string; code: string; name: string }; user: MemberRow; _count: { phoneUnlocks: number } })[],
    now: Date,
  ) {
    const emails = await this.adminEmails(rows.flatMap((r) => [r.grantedByAdminId, r.cancelledByAdminId]));
    return rows.map((r) => ({
      id: r.id,
      state: subscriptionState(r, now),
      member: toMember(r.user),
      plan: { id: r.plan.id, code: r.plan.code, name: r.plan.name },
      source: r.source,
      orderId: r.orderId,
      startedAt: r.startedAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      grantedByEmail: r.grantedByAdminId ? (emails.get(r.grantedByAdminId) ?? null) : null,
      grantReason: r.grantReason,
      paymentReference: r.paymentReference,
      cancelledAt: r.cancelledAt?.toISOString() ?? null,
      cancelledByEmail: r.cancelledByAdminId ? (emails.get(r.cancelledByAdminId) ?? null) : null,
      cancelReason: r.cancelReason,
      phoneUnlocksUsed: r._count.phoneUnlocks,
    }));
  }

  private readonly subscriptionInclude = {
    plan: { select: { id: true, code: true, name: true } },
    user: { select: memberSelect },
    _count: { select: { phoneUnlocks: true } },
  } as const;

  // Newest first; the cursor is "<createdAt ISO>_<id>".
  async listSubscriptions(query: AdminSubscriptionsQuery) {
    const now = new Date();
    const and: Prisma.SubscriptionWhereInput[] = [];
    if (query.state) and.push(subscriptionStateWhere(query.state, now));
    if (query.planCode) and.push({ plan: { code: query.planCode } });
    if (query.source) and.push({ source: query.source });
    const search = memberSearch(query.search);
    if (search) and.push({ user: search });
    if (query.cursor) {
      const [iso, id] = query.cursor.split('_');
      const at = new Date(iso ?? '');
      if (!id || Number.isNaN(at.getTime())) throw new BadRequestException('Invalid cursor');
      and.push({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] });
    }
    const rows = await this.prisma.subscription.findMany({
      where: { AND: and },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: this.subscriptionInclude,
    });
    const page = rows.slice(0, query.limit);
    const last = page[page.length - 1];
    return {
      items: await this.toSubscriptionViews(page, now),
      nextCursor: rows.length > query.limit && last ? `${last.createdAt.toISOString()}_${last.id}` : null,
    };
  }

  async getSubscription(id: string) {
    const row = await this.prisma.subscription.findUnique({ where: { id }, include: this.subscriptionInclude });
    if (!row) throw new NotFoundException('Subscription not found');
    return (await this.toSubscriptionViews([row], new Date()))[0]!;
  }

  // A complimentary or offline-paid plan. Same chaining as a payment
  // (SubscriptionService.activate): it starts when the member's current
  // plan ends. Never counted as revenue.
  async grant(adminId: string, body: GrantSubscriptionRequest) {
    const member = await this.prisma.user.findUnique({ where: { id: body.memberId }, select: { status: true } });
    if (!member) throw new NotFoundException('Member not found');
    if (member.status === 'DELETED') throw new ConflictException('This account has been anonymized');
    const { subscription, plan } = await this.subscriptions.activate({
      userId: body.memberId,
      planId: body.planId,
      source: 'ADMIN_GRANT',
      grantedByAdminId: adminId,
      reason: body.reason,
      paymentReference: body.paymentReference || undefined,
      durationDays: body.durationDays,
    });
    await this.auditLog.record(adminId, 'subscription.grant', 'Subscription', subscription.id, {
      userId: body.memberId,
      planCode: plan.code,
      durationDays: body.durationDays ?? plan.durationDays,
      startedAt: subscription.startedAt.toISOString(),
      expiresAt: subscription.expiresAt.toISOString(),
      reason: body.reason,
      ...(body.paymentReference ? { paymentReference: body.paymentReference } : {}),
    });
    return this.getSubscription(subscription.id);
  }

  async cancel(adminId: string, id: string, reason: string) {
    const cancelled = await this.subscriptions.cancel(id, { adminId, reason });
    await this.auditLog.record(adminId, 'subscription.cancel', 'Subscription', id, {
      userId: cancelled.userId,
      planCode: cancelled.plan.code,
      reason,
    });
    return this.getSubscription(id);
  }

  // --- Orders ---------------------------------------------------------------

  private readonly orderInclude = {
    plan: { select: { id: true, code: true, name: true } },
    user: { select: memberSelect },
    subscription: { select: { id: true, cancelledAt: true, startedAt: true, expiresAt: true } },
  } as const;

  private async toOrderViews(rows: Prisma.OrderGetPayload<{ include: AdminBillingService['orderInclude'] }>[]) {
    const now = new Date();
    const emails = await this.adminEmails(rows.map((r) => r.refundedByAdminId));
    return rows.map((r) => ({
      id: r.id,
      member: toMember(r.user),
      plan: r.plan,
      amountInPaise: r.amountInPaise,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      paidAt: r.paidAt?.toISOString() ?? null,
      refundedAt: r.refundedAt?.toISOString() ?? null,
      refundReason: r.refundReason,
      refundedByEmail: r.refundedByAdminId ? (emails.get(r.refundedByAdminId) ?? null) : null,
      subscription: r.subscription ? { id: r.subscription.id, state: subscriptionState(r.subscription, now) } : null,
    }));
  }

  async listOrders(query: AdminOrdersQuery) {
    const and: Prisma.OrderWhereInput[] = [];
    if (query.status) and.push({ status: query.status });
    if (query.from) and.push({ createdAt: { gte: istDateStart(query.from) } });
    if (query.to) and.push({ createdAt: { lt: new Date(istDateStart(query.to).getTime() + 24 * 60 * 60 * 1000) } });
    if (query.search) {
      const search = memberSearch(query.search)!;
      and.push({ OR: [{ id: query.search }, { user: search }] });
    }
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: query.offset, take: query.limit, include: this.orderInclude }),
      this.prisma.order.count({ where }),
    ]);
    return { items: await this.toOrderViews(rows), total };
  }

  // The order plus every payment event recorded for it. Only events whose
  // signature verified are ever stored (others are rejected before saving).
  async getOrder(id: string) {
    const row = await this.prisma.order.findUnique({ where: { id }, include: { ...this.orderInclude, payments: { orderBy: { createdAt: 'asc' } } } });
    if (!row) throw new NotFoundException('Order not found');
    const [view] = await this.toOrderViews([row]);
    return {
      ...view!,
      paymentEvents: row.payments.map((p) => {
        const payload = (p.rawPayload ?? {}) as { amountInPaise?: unknown; currency?: unknown };
        return {
          providerEventId: p.providerEventId,
          type: p.status,
          amountInPaise: typeof payload.amountInPaise === 'number' ? payload.amountInPaise : null,
          currency: typeof payload.currency === 'string' ? payload.currency : null,
          signatureValid: true,
          processedAt: p.createdAt.toISOString(),
        };
      }),
    };
  }

  // Orders that need a person to look at them: paid with no plan behind
  // them, or created more than 30 minutes ago and never paid.
  async attention(now: Date = new Date()) {
    const [paidWithoutSubscription, staleCreated] = await Promise.all([
      this.prisma.order.findMany({ where: { status: 'PAID', subscription: null }, orderBy: { createdAt: 'desc' }, take: 50, include: this.orderInclude }),
      this.prisma.order.findMany({
        where: { status: 'CREATED', createdAt: { lt: new Date(now.getTime() - STALE_CREATED_ORDER_MS) } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: this.orderInclude,
      }),
    ]);
    return { paidWithoutSubscription: await this.toOrderViews(paidWithoutSubscription), staleCreated: await this.toOrderViews(staleCreated) };
  }

  // Activate the plan for a PAID order that has none (e.g. activation failed
  // after payment). Idempotent: an order never gets a second subscription.
  async activateOrder(adminId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'PAID') throw new ConflictException('Only a paid order can be activated');
    const { subscription, created } = await this.subscriptions.activate({
      userId: order.userId,
      planId: order.planId,
      source: 'PAYMENT',
      orderId: order.id,
    });
    if (created) {
      await this.auditLog.record(adminId, 'order.activate', 'Order', orderId, {
        userId: order.userId,
        subscriptionId: subscription.id,
        startedAt: subscription.startedAt.toISOString(),
        expiresAt: subscription.expiresAt.toISOString(),
      });
    }
    return { created, subscriptionId: subscription.id, order: await this.getOrder(orderId) };
  }

  // Records a refund here (PAID -> REFUNDED only) and ends that order's plan;
  // the member's queued plans move up with no gap. No money moves: the admin
  // returns it in the payment gateway. Phone unlocks already made stay.
  async refund(adminId: string, orderId: string, reason: string, now: Date = new Date()) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    const cancelled = await this.prisma.$transaction(async (tx) => {
      await this.subscriptions.lockMember(tx, order.userId);
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: 'PAID' },
        data: { status: 'REFUNDED', refundedAt: now, refundReason: reason, refundedByAdminId: adminId },
      });
      if (count === 0) throw new ConflictException('Only a paid order can be refunded');
      const subscription = await tx.subscription.findUnique({ where: { orderId } });
      if (subscription && !subscription.cancelledAt && subscription.expiresAt > now) {
        return this.subscriptions.cancelInTx(tx, subscription.id, { adminId, reason: `Order refunded: ${reason}` }, now);
      }
      return null;
    });
    if (cancelled) this.subscriptions.notifyCancelled(cancelled);
    await this.auditLog.record(adminId, 'order.refund', 'Order', orderId, {
      userId: order.userId,
      amountInPaise: order.amountInPaise,
      reason,
      cancelledSubscriptionId: cancelled?.id ?? null,
    });
    return this.getOrder(orderId);
  }

  // --- Member detail ----------------------------------------------------------

  async memberMembership(userId: string, now: Date = new Date()) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('Member not found');
    const { start, resetsAt } = istMonthWindow(now);
    const [subs, totalUnlocks, interests, orders] = await Promise.all([
      this.prisma.subscription.findMany({ where: { userId }, orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }], include: this.subscriptionInclude }),
      this.prisma.phoneUnlock.count({ where: { viewerId: userId } }),
      this.prisma.interest.count({ where: { senderId: userId, createdAt: { gte: start, lt: resetsAt } } }),
      this.prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10, include: this.orderInclude }),
    ]);
    const subscriptions = await this.toSubscriptionViews(subs, now);
    const current = subscriptions.find((s) => s.state === 'ACTIVE') ?? null;
    return {
      subscriptions,
      currentSubscriptionId: current?.id ?? null,
      phoneUnlocksThisPlan: current?.phoneUnlocksUsed ?? null,
      phoneUnlocksTotal: totalUnlocks,
      interestsSentThisMonth: interests,
      monthResetsAt: resetsAt.toISOString(),
      recentOrders: await this.toOrderViews(orders),
    };
  }
}
