import type { RecentActivityItem } from '@nadar-kalyanam/schemas';
import { PERMISSIONS } from '../../common/permissions.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedAdmin } from './guards/admin-auth.guard.js';

// Merges already-sorted, already-bounded source lists into one feed: newest
// first, ties broken by id for a stable order, cut to `limit`.
export function mergeActivity(lists: RecentActivityItem[][], limit: number): RecentActivityItem[] {
  return lists
    .flat()
    .sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at < b.at ? 1 : -1))
    .slice(0, limit);
}

type MemberRow = { id: string; phoneNumber: string; profile: { fullName: string } | null };
const toMember = (user: MemberRow) => ({ userId: user.id, fullName: user.profile?.fullName ?? null, phoneNumber: user.phoneNumber });

// Recent Activity: each source is read with its own bounded, index-ordered
// query (newest `limit` rows only), then merged — never the whole tables.
// Sources follow the same permissions as their own admin pages: reports
// only for admins who can review reports, admin actions only for admins
// who can see the audit log. Registrations and verifications fall under
// members.view, which the dashboard itself requires.
export async function loadRecentActivity(
  prisma: PrismaService,
  admin: AuthenticatedAdmin,
  limit: number,
): Promise<RecentActivityItem[]> {
  const can = (code: string) => admin.permissions.includes(code);
  const member = { select: { id: true, phoneNumber: true, profile: { select: { fullName: true } } } } as const;

  const [users, verifications, reports, audits] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { ...member.select, createdAt: true },
    }),
    prisma.verificationRequest.findMany({
      where: { status: 'SUCCEEDED', decidedAt: { not: null } },
      orderBy: { decidedAt: 'desc' },
      take: limit,
      select: { id: true, decidedAt: true, user: member },
    }),
    can(PERMISSIONS.REPORTS_REVIEW)
      ? prisma.report.findMany({ orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, targetType: true, status: true, createdAt: true } })
      : Promise.resolve([]),
    can(PERMISSIONS.ADMIN_USERS_MANAGE)
      ? prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit, include: { admin: { select: { email: true } } } })
      : Promise.resolve([]),
  ]);

  // The member each admin action was about: the target itself for User
  // actions, metadata.userId for profile edits and photo removals.
  const memberIdOf = (entry: (typeof audits)[number]) =>
    entry.targetType === 'User' ? entry.targetId : ((entry.metadata as { userId?: unknown } | null)?.userId as string | undefined);
  const memberIds = [...new Set(audits.map(memberIdOf).filter((id): id is string => Boolean(id)))];
  const adminIds = [...new Set(audits.filter((a) => a.targetType === 'AdminUser').map((a) => a.targetId))];
  const [auditMembers, auditAdmins] = await Promise.all([
    memberIds.length ? prisma.user.findMany({ where: { id: { in: memberIds } }, ...member }) : Promise.resolve([]),
    adminIds.length ? prisma.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } }) : Promise.resolve([]),
  ]);
  const membersById = new Map(auditMembers.map((u) => [u.id, toMember(u)]));
  const adminEmailById = new Map(auditAdmins.map((a) => [a.id, a.email]));

  return mergeActivity(
    [
      users.map((u) => ({ type: 'registration' as const, id: `user:${u.id}`, at: u.createdAt.toISOString(), member: toMember(u) })),
      verifications.map((v) => ({ type: 'verification' as const, id: `verification:${v.id}`, at: v.decidedAt!.toISOString(), member: toMember(v.user) })),
      reports.map((r) => ({ type: 'report' as const, id: `report:${r.id}`, at: r.createdAt.toISOString(), targetType: r.targetType, status: r.status })),
      audits.map((a) => {
        const userId = memberIdOf(a);
        return {
          type: 'admin_action' as const,
          id: `audit:${a.id}`,
          at: a.createdAt.toISOString(),
          action: a.action,
          actorEmail: a.admin?.email ?? null,
          targetType: a.targetType,
          member: userId ? (membersById.get(userId) ?? null) : null,
          targetAdminEmail: a.targetType === 'AdminUser' ? (adminEmailById.get(a.targetId) ?? null) : null,
        };
      }),
    ],
    limit,
  );
}
