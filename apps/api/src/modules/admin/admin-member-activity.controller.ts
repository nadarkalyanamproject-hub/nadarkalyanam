import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '../../common/permissions.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from './audit-log.service.js';
import { CurrentAdmin } from './decorators/current-admin.decorator.js';
import { RequirePermission } from './decorators/require-permission.decorator.js';
import { AdminAuthGuard, type AuthenticatedAdmin } from './guards/admin-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

// How many of the newest rows each list on the member page returns. Totals
// are always exact, so staff can tell when a list is cut short.
export const ACTIVITY_LIST_LIMIT = 100;
// The newest messages shown when staff open one conversation.
export const CONVERSATION_MESSAGE_LIMIT = 500;

interface PersonRef {
  userId: string;
  fullName: string | null;
  phoneNumber: string;
}

// Everything the platform holds about one member, for the admin member page.
// members.view shows activity (who, what, when) but never message text:
// reading a conversation needs messages.view and is recorded in the audit
// log every time, because those are members' private words.
@Controller('admin')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminMemberActivityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get('members/:userId/activity')
  @RequirePermission(PERMISSIONS.MEMBERS_VIEW)
  async memberActivity(@Param('userId') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, profile: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('Member not found');
    const profileId = user.profile?.id ?? null;
    const take = ACTIVITY_LIST_LIMIT;
    const newest = { createdAt: 'desc' as const };

    const ownMessageIds = (
      await this.prisma.message.findMany({ where: { senderId: userId }, select: { id: true } })
    ).map((m) => m.id);
    const reportsAgainstWhere = {
      OR: [
        ...(profileId ? [{ targetType: 'PROFILE', targetId: profileId }] : []),
        ...(ownMessageIds.length ? [{ targetType: 'MESSAGE', targetId: { in: ownMessageIds } }] : []),
      ],
    };
    const hasReportsAgainst = reportsAgainstWhere.OR.length > 0;
    // Actions aimed at the account or profile, plus ones that name the member
    // in their details (for example a chat read, which targets the chat).
    const adminActionsWhere = {
      OR: [
        { targetId: { in: [userId, ...(profileId ? [profileId] : [])] } },
        { metadata: { path: ['userId'], equals: userId } },
      ],
    };

    const [
      interestsSent, interestsSentTotal, interestsReceived, interestsReceivedTotal,
      shortlisted, shortlistedTotal, shortlistedBy, shortlistedByTotal,
      blocksMade, blockedBy,
      reportsMade, reportsMadeTotal, reportsAgainst, reportsAgainstTotal,
      participations, calls, callsTotal,
      sessions, devices,
      notifications, notificationsTotal, notificationsUnread,
      poruthamReports, orders, ordersTotal,
      adminActions, adminActionsTotal,
    ] = await Promise.all([
      this.prisma.interest.findMany({ where: { senderId: userId }, orderBy: newest, take }),
      this.prisma.interest.count({ where: { senderId: userId } }),
      this.prisma.interest.findMany({ where: { targetId: userId }, orderBy: newest, take }),
      this.prisma.interest.count({ where: { targetId: userId } }),
      this.prisma.shortlist.findMany({ where: { memberId: userId }, orderBy: newest, take, include: { profile: { select: { userId: true } } } }),
      this.prisma.shortlist.count({ where: { memberId: userId } }),
      profileId ? this.prisma.shortlist.findMany({ where: { profileId }, orderBy: newest, take }) : Promise.resolve([]),
      profileId ? this.prisma.shortlist.count({ where: { profileId } }) : Promise.resolve(0),
      this.prisma.block.findMany({ where: { initiatorId: userId }, orderBy: newest, take }),
      this.prisma.block.findMany({ where: { targetId: userId }, orderBy: newest, take }),
      this.prisma.report.findMany({ where: { reporterId: userId }, orderBy: newest, take }),
      this.prisma.report.count({ where: { reporterId: userId } }),
      hasReportsAgainst ? this.prisma.report.findMany({ where: reportsAgainstWhere, orderBy: newest, take }) : Promise.resolve([]),
      hasReportsAgainst ? this.prisma.report.count({ where: reportsAgainstWhere }) : Promise.resolve(0),
      this.prisma.conversationParticipant.findMany({
        where: { userId },
        orderBy: newest,
        take,
        include: {
          conversation: {
            select: {
              id: true,
              createdAt: true,
              participants: { select: { userId: true } },
              _count: { select: { messages: true } },
              messages: { orderBy: newest, take: 1, select: { createdAt: true } },
            },
          },
        },
      }),
      this.prisma.call.findMany({ where: { OR: [{ callerId: userId }, { calleeId: userId }] }, orderBy: { startedAt: 'desc' }, take }),
      this.prisma.call.count({ where: { OR: [{ callerId: userId }, { calleeId: userId }] } }),
      this.prisma.session.findMany({ where: { userId, adminUserId: null }, orderBy: newest, take: 50 }),
      this.prisma.device.findMany({ where: { userId }, orderBy: newest, take: 50 }),
      this.prisma.notification.findMany({ where: { userId }, orderBy: newest, take }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, read: false } }),
      this.prisma.horoscopeMatch.findMany({
        where: { userId },
        orderBy: newest,
        take,
        include: { profile: { select: { userId: true } }, order: { select: { id: true, status: true, amountInPaise: true } } },
      }),
      this.prisma.order.findMany({ where: { userId }, orderBy: newest, take, include: { plan: { select: { name: true } } } }),
      this.prisma.order.count({ where: { userId } }),
      this.prisma.auditLog.findMany({ where: adminActionsWhere, orderBy: newest, take, include: { admin: { select: { email: true } } } }),
      this.prisma.auditLog.count({ where: adminActionsWhere }),
    ]);

    // Names and numbers of everyone those rows point at, in one query.
    const otherIds = new Set<string>();
    interestsSent.forEach((i) => otherIds.add(i.targetId));
    interestsReceived.forEach((i) => otherIds.add(i.senderId));
    shortlisted.forEach((s) => otherIds.add(s.profile.userId));
    shortlistedBy.forEach((s) => otherIds.add(s.memberId));
    blocksMade.forEach((b) => otherIds.add(b.targetId));
    blockedBy.forEach((b) => otherIds.add(b.initiatorId));
    reportsAgainst.forEach((r) => otherIds.add(r.reporterId));
    participations.forEach((p) => p.conversation.participants.forEach((x) => otherIds.add(x.userId)));
    calls.forEach((c) => { otherIds.add(c.callerId); otherIds.add(c.calleeId); });
    poruthamReports.forEach((h) => otherIds.add(h.profile.userId));
    otherIds.delete(userId);
    const people = await this.people([...otherIds]);
    const person = (id: string): PersonRef => people.get(id) ?? { userId: id, fullName: null, phoneNumber: '' };

    // What a report made BY this member points at.
    const reportedProfileIds = reportsMade.filter((r) => r.targetType === 'PROFILE').map((r) => r.targetId);
    const reportedMessageIds = reportsMade.filter((r) => r.targetType === 'MESSAGE').map((r) => r.targetId);
    const [reportedProfiles, reportedMessages] = await Promise.all([
      reportedProfileIds.length ? this.prisma.profile.findMany({ where: { id: { in: reportedProfileIds } }, select: { id: true, userId: true } }) : [],
      reportedMessageIds.length ? this.prisma.message.findMany({ where: { id: { in: reportedMessageIds } }, select: { id: true, senderId: true } }) : [],
    ]);
    const reportedUserIds = [...reportedProfiles.map((p) => p.userId), ...reportedMessages.map((m) => m.senderId)].filter((id) => !people.has(id));
    for (const [id, ref] of await this.people(reportedUserIds)) people.set(id, ref);
    const reportTarget = (targetType: string, targetId: string): PersonRef | null => {
      const ownerId =
        targetType === 'PROFILE'
          ? reportedProfiles.find((p) => p.id === targetId)?.userId
          : reportedMessages.find((m) => m.id === targetId)?.senderId;
      return ownerId ? person(ownerId) : null;
    };

    const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
    const now = Date.now();

    return {
      limit: take,
      interests: {
        sent: interestsSent.map((i) => ({ id: i.id, member: person(i.targetId), status: i.status, createdAt: iso(i.createdAt), respondedAt: iso(i.respondedAt) })),
        sentTotal: interestsSentTotal,
        received: interestsReceived.map((i) => ({ id: i.id, member: person(i.senderId), status: i.status, createdAt: iso(i.createdAt), respondedAt: iso(i.respondedAt) })),
        receivedTotal: interestsReceivedTotal,
      },
      shortlists: {
        made: shortlisted.map((s) => ({ id: s.id, member: person(s.profile.userId), createdAt: iso(s.createdAt) })),
        madeTotal: shortlistedTotal,
        by: shortlistedBy.map((s) => ({ id: s.id, member: person(s.memberId), createdAt: iso(s.createdAt) })),
        byTotal: shortlistedByTotal,
      },
      blocks: {
        made: blocksMade.map((b) => ({ id: b.id, member: person(b.targetId), createdAt: iso(b.createdAt) })),
        by: blockedBy.map((b) => ({ id: b.id, member: person(b.initiatorId), createdAt: iso(b.createdAt) })),
      },
      reports: {
        made: reportsMade.map((r) => ({ id: r.id, targetType: r.targetType, against: reportTarget(r.targetType, r.targetId), reason: r.reason, status: r.status, createdAt: iso(r.createdAt), resolvedAt: iso(r.resolvedAt) })),
        madeTotal: reportsMadeTotal,
        against: reportsAgainst.map((r) => ({ id: r.id, targetType: r.targetType, reporter: person(r.reporterId), reason: r.reason, status: r.status, createdAt: iso(r.createdAt), resolvedAt: iso(r.resolvedAt) })),
        againstTotal: reportsAgainstTotal,
      },
      conversations: participations.map((p) => {
        const otherId = p.conversation.participants.find((x) => x.userId !== userId)?.userId;
        return {
          id: p.conversation.id,
          with: otherId ? person(otherId) : null,
          messageCount: p.conversation._count.messages,
          startedAt: iso(p.conversation.createdAt),
          lastMessageAt: iso(p.conversation.messages[0]?.createdAt),
        };
      }),
      calls: {
        items: calls.map((c) => ({
          id: c.id,
          direction: c.callerId === userId ? 'OUTGOING' : 'INCOMING',
          with: person(c.callerId === userId ? c.calleeId : c.callerId),
          status: c.status,
          startedAt: iso(c.startedAt),
          durationSeconds: c.durationSeconds,
        })),
        total: callsTotal,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceLabel: s.deviceLabel,
        createdAt: iso(s.createdAt),
        expiresAt: iso(s.expiresAt),
        revokedAt: iso(s.revokedAt),
        active: !s.revokedAt && s.expiresAt.getTime() > now,
      })),
      devices: devices.map((d) => ({ id: d.id, platform: d.platform, pushEnabled: Boolean(d.pushToken), createdAt: iso(d.createdAt) })),
      notifications: {
        items: notifications.map((n) => ({ id: n.id, type: n.type, read: n.read, createdAt: iso(n.createdAt) })),
        total: notificationsTotal,
        unread: notificationsUnread,
      },
      poruthamReports: poruthamReports.map((h) => ({
        id: h.id,
        member: person(h.profile.userId),
        createdAt: iso(h.createdAt),
        order: h.order ? { id: h.order.id, status: h.order.status, amountInPaise: h.order.amountInPaise } : null,
      })),
      orders: {
        items: orders.map((o) => ({
          id: o.id,
          kind: o.kind,
          planName: o.plan?.name ?? null,
          amountInPaise: o.amountInPaise,
          status: o.status,
          createdAt: iso(o.createdAt),
          paidAt: iso(o.paidAt),
          refundedAt: iso(o.refundedAt),
        })),
        total: ordersTotal,
      },
      adminActions: {
        items: adminActions.map((a) => ({
          id: a.id,
          action: a.action,
          admin: a.admin.email,
          metadata: a.metadata,
          createdAt: iso(a.createdAt),
        })),
        total: adminActionsTotal,
      },
    };
  }

  // One conversation's messages, oldest first. Staff must hold
  // messages.view, the member must be in the conversation, and every
  // opening is written to the audit log (who read whose chat, and when).
  @Get('members/:userId/conversations/:conversationId/messages')
  @RequirePermission(PERMISSIONS.MESSAGES_VIEW)
  async conversationMessages(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('userId') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, participants: { some: { userId } } },
      select: { id: true, createdAt: true, participants: { select: { userId: true } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found for this member');

    const [latest, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: CONVERSATION_MESSAGE_LIMIT,
        select: { id: true, senderId: true, body: true, status: true, createdAt: true },
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);
    const people = await this.people(conversation.participants.map((p) => p.userId));

    await this.auditLog.record(admin.adminId, 'member.conversation.view', 'Conversation', conversationId, {
      userId,
      participants: conversation.participants.map((p) => p.userId),
      messagesShown: latest.length,
    });

    return {
      id: conversation.id,
      startedAt: conversation.createdAt.toISOString(),
      participants: conversation.participants.map((p) => people.get(p.userId) ?? { userId: p.userId, fullName: null, phoneNumber: '' }),
      total,
      messages: latest.reverse().map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, status: m.status, createdAt: m.createdAt.toISOString() })),
    };
  }

  private async people(userIds: string[]): Promise<Map<string, PersonRef>> {
    if (userIds.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, phoneNumber: true, profile: { select: { fullName: true } } },
    });
    return new Map(users.map((u) => [u.id, { userId: u.id, fullName: u.profile?.fullName ?? null, phoneNumber: u.phoneNumber }]));
  }
}
