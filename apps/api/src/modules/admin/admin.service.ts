import { ConflictException, Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import type { AccountStatus, MemberActivityResponse } from '@nadar-kalyanam/schemas';
import type { Prisma } from '../../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from './audit-log.service.js';
import { scheduledAnonymizationDate } from './member-removal.js';
import { ACTIVITY_TZ_OFFSET_MINUTES, activityWindow, buildActivitySeries } from './member-activity.js';

export interface MemberListFilters {
  status?: AccountStatus;
  verified?: boolean;
  sort?: 'newest' | 'oldest';
}

// FR-9.5 / FR-11.4: suspend/reinstate are reachable by both Moderator and
// Super Admin per the use case diagram's reading note — the permission table
// (not this service) is what actually restricts who may call it.
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly photosService: PhotosService,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
  ) {}

  // FR-11.1/11.2: basic search by phone, name, or email so an admin can
  // actually find someone to act on. Queries User (not Profile) as the base
  // entity — a member who registered but never finished onboarding still
  // has no Profile row and must still be findable/actionable. Filters AND
  // together with the search; "not verified" deliberately includes members
  // with no profile at all, since they aren't verified either.
  async listMembers(offset: number, limit: number, search?: string, filters: MemberListFilters = {}) {
    const conditions: Prisma.UserWhereInput[] = [];
    if (search) {
      conditions.push({
        OR: [
          { phoneNumber: { contains: search, mode: 'insensitive' } },
          { profile: { fullName: { contains: search, mode: 'insensitive' } } },
          { profile: { details: { path: ['email'], string_contains: search } } },
        ],
      });
    }
    if (filters.status) {
      conditions.push({ status: filters.status });
    }
    if (filters.verified === true) {
      conditions.push({ profile: { isVerified: true } });
    } else if (filters.verified === false) {
      conditions.push({ OR: [{ profile: null }, { profile: { isVerified: false } }] });
    }
    const where: Prisma.UserWhereInput =
      conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : { AND: conditions };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { profile: { select: { id: true, fullName: true, completionScore: true, isVerified: true } } },
        orderBy: { createdAt: filters.sort === 'oldest' ? 'asc' : 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((user) => ({
        id: user.id,
        phoneNumber: user.phoneNumber,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        profileId: user.profile?.id ?? null,
        fullName: user.profile?.fullName ?? null,
        completionScore: user.profile?.completionScore ?? null,
        isVerified: user.profile?.isVerified ?? false,
      })),
      total,
    };
  }

  // The admin's own privileged view — more than what any other member (or
  // the SRS's public-profile mapper) ever sees. Nothing on User/Profile is
  // more sensitive than what the owner's own GET /profiles/me already
  // returns (no payment card data or raw OTPs are ever persisted), so
  // returning the full details blob here doesn't expose anything new — it
  // just skips the "hide from other members" narrowing that's specific to
  // peer-to-peer visibility, which doesn't apply to admin support/moderation
  // use. Photo URLs are signed via PhotosService, same as everywhere else —
  // never constructed ad hoc.
  async getMemberDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      throw new NotFoundException('Member not found');
    }

    const photos = user.profile ? await this.photosService.getPhotosForProfile(user.profile.id) : [];

    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      status: user.status,
      deletionRequestedAt: user.deletionRequestedAt?.toISOString() ?? null,
      scheduledAnonymizationAt: user.deletionRequestedAt
        ? scheduledAnonymizationDate(user.deletionRequestedAt).toISOString()
        : null,
      createdAt: user.createdAt.toISOString(),
      profile: user.profile
        ? {
            id: user.profile.id,
            fullName: user.profile.fullName,
            gender: user.profile.gender,
            dateOfBirth: user.profile.dateOfBirth.toISOString().slice(0, 10),
            visibility: user.profile.visibility,
            completionScore: user.profile.completionScore,
            isVerified: user.profile.isVerified,
            details: user.profile.details,
            photos,
          }
        : null,
    };
  }

  // Member-state guard shared by every admin write on a member. DELETED is
  // terminal (the account has been anonymized — there is nothing left to act
  // on), and PENDING_DELETION can only be left via restoreMember: letting
  // suspend/reinstate flip the status would silently cancel the scheduled
  // anonymization without clearing deletionRequestedAt or leaving a
  // "member.restore" audit entry.
  private async getActionableMember(userId: string, action: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminUser: { select: { id: true } } },
    });
    if (!user) {
      throw new NotFoundException('Member not found');
    }
    if (user.status === 'DELETED') {
      throw new ConflictException(`Cannot ${action}: this account has already been anonymized`);
    }
    return user;
  }

  // Used by the profile-edit route, which calls ProfilesService directly —
  // an anonymized profile must not be re-populated by an admin edit.
  async assertMemberNotDeleted(userId: string, action: string): Promise<void> {
    await this.getActionableMember(userId, action);
  }

  async suspendMember(adminId: string, userId: string, reason: string) {
    const user = await this.getActionableMember(userId, 'suspend');
    if (user.status === 'PENDING_DELETION') {
      throw new ConflictException('Member is pending removal — cancel the removal first');
    }
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
    await this.auditLog.record(adminId, 'member.suspend', 'User', userId, { reason });
    this.notifications.notify({ recipientUserId: userId, type: 'ACCOUNT_SUSPENDED', targetType: 'Account' });
    return { id: updated.id, status: updated.status };
  }

  async reinstateMember(adminId: string, userId: string) {
    const user = await this.getActionableMember(userId, 'reinstate');
    if (user.status === 'PENDING_DELETION') {
      throw new ConflictException('Member is pending removal — use "Cancel removal" instead');
    }
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
    await this.auditLog.record(adminId, 'member.reinstate', 'User', userId, {});
    this.notifications.notify({ recipientUserId: userId, type: 'ACCOUNT_REINSTATED', targetType: 'Account' });
    return { id: updated.id, status: updated.status };
  }

  // FR-1.5's grace-period-then-anonymize deletion, admin-initiated instead
  // of self-initiated — the SAME state transition self-service deletion
  // would use, not a separate mechanism. Setting status away from ACTIVE
  // already has a real, immediate effect: discovery/matching/messaging all
  // filter on user.status === 'ACTIVE', so this member drops out of search
  // and recommendations right away. The anonymization itself is done by
  // AnonymizationService once the grace period elapses (off unless
  // ENABLE_ANONYMIZATION_JOB=true).
  //
  // A User linked to an AdminUser is refused: anonymizing it would replace
  // the phone number that admin logs in with. Deactivate the admin account
  // (Admins page) instead.
  async removeMember(adminId: string, userId: string, reason: string) {
    const user = await this.getActionableMember(userId, 'remove');
    if (user.status === 'PENDING_DELETION') {
      throw new ConflictException('Member is already pending removal');
    }
    if (user.adminUser) {
      throw new ConflictException('This account is linked to an admin user — deactivate the admin instead');
    }
    const deletionRequestedAt = new Date();
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'PENDING_DELETION', deletionRequestedAt },
    });
    const scheduledAt = scheduledAnonymizationDate(deletionRequestedAt);
    await this.auditLog.record(adminId, 'member.remove', 'User', userId, {
      reason,
      scheduledAnonymizationAt: scheduledAt.toISOString(),
    });
    this.notifications.notify({
      recipientUserId: userId,
      type: 'REMOVAL_SCHEDULED',
      targetType: 'Account',
      data: { scheduledAt: scheduledAt.toISOString() },
    });
    return {
      id: updated.id,
      status: updated.status,
      deletionRequestedAt: deletionRequestedAt.toISOString(),
      scheduledAnonymizationAt: scheduledAt.toISOString(),
    };
  }

  // Cancels a pending removal. Only valid strictly before the scheduled
  // anonymization date — from that instant on the member is eligible for
  // the anonymization job (see anonymizationCutoff), and the two windows
  // must not overlap. Status goes back to ACTIVE, not whatever it was before
  // removal (that isn't recorded on User). The conditional updateMany
  // re-checks the exact state read above, so a concurrent restore or job
  // run can't be double-applied.
  async restoreMember(adminId: string, userId: string) {
    const user = await this.getActionableMember(userId, 'restore');
    if (user.status !== 'PENDING_DELETION' || !user.deletionRequestedAt) {
      throw new ConflictException('Member is not pending removal');
    }
    const scheduledAt = scheduledAnonymizationDate(user.deletionRequestedAt);
    if (scheduledAt.getTime() <= Date.now()) {
      throw new ConflictException('The grace period has already elapsed; this removal can no longer be cancelled');
    }

    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, status: 'PENDING_DELETION', deletionRequestedAt: user.deletionRequestedAt },
      data: { status: 'ACTIVE', deletionRequestedAt: null },
    });
    if (count === 0) {
      throw new ConflictException('Member state changed concurrently; reload and try again');
    }
    this.notifications.notify({ recipientUserId: userId, type: 'REMOVAL_CANCELLED', targetType: 'Account' });
    await this.auditLog.record(adminId, 'member.restore', 'User', userId, {
      deletionRequestedAt: user.deletionRequestedAt.toISOString(),
      scheduledAnonymizationAt: scheduledAt.toISOString(),
    });
    return { id: userId, status: 'ACTIVE' as const };
  }

  // Admin photo moderation. PhotosService.deletePhoto is already scoped to
  // "this user's own profile", which is exactly the check needed here too
  // (a photoId belonging to someone else 404s) — reused as-is, including
  // its DB-row-then-storage-object ordering.
  async removeMemberPhoto(adminId: string, userId: string, photoId: string, reason: string) {
    await this.getActionableMember(userId, 'remove photo');
    const removed = await this.photosService.deletePhoto(userId, photoId);
    this.notifications.notify({ recipientUserId: userId, type: 'ADMIN_PHOTO_REMOVED', targetType: 'Account' });
    await this.auditLog.record(adminId, 'member.photo.remove', 'ProfilePhoto', photoId, {
      reason,
      userId,
      objectKey: removed.objectKey,
    });
    return { id: photoId, removed: true };
  }

  // Platform-overview landing page. The status breakdown covers all four
  // AccountStatus values (DELETED is set by the anonymization job).
  // totalMembers intentionally has no status filter, matching listMembers'
  // own definition of "member" (a User row, regardless of status/profile
  // completion). "Pending reports" uses the same OPEN/IN_REVIEW definition
  // ModerationService.listQueue already uses for its queue, so this number
  // always matches what an admin sees if they click through to Reports.
  async getDashboardStats() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [
      totalMembers,
      statusGroups,
      newSignupsLast7Days,
      pendingReportsCount,
      verifiedProfilesCount,
      recentUsers,
      newSignupsPrevious7Days,
      verificationsLast7Days,
    ] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        this.prisma.report.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }),
        this.prisma.profile.count({ where: { isVerified: true } }),
        this.prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { profile: { select: { fullName: true } } },
        }),
        // The 7 days before the last 7, for New Signups' week-over-week.
        this.prisma.user.count({ where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
        // isVerified has no timestamp, so "verified this week" counts
        // identity verifications that completed successfully this week.
        this.prisma.verificationRequest.count({ where: { status: 'SUCCEEDED', decidedAt: { gte: sevenDaysAgo } } }),
      ]);

    const membersByStatus = { active: 0, suspended: 0, pendingDeletion: 0, deleted: 0 };
    for (const group of statusGroups) {
      if (group.status === 'ACTIVE') membersByStatus.active = group._count._all;
      else if (group.status === 'SUSPENDED') membersByStatus.suspended = group._count._all;
      else if (group.status === 'PENDING_DELETION') membersByStatus.pendingDeletion = group._count._all;
      else if (group.status === 'DELETED') membersByStatus.deleted = group._count._all;
    }

    return {
      totalMembers,
      membersByStatus,
      newSignupsLast7Days,
      newSignupsPrevious7Days,
      pendingReportsCount,
      verifiedProfilesCount,
      verificationsLast7Days,
      recentSignups: recentUsers.map((user) => ({
        id: user.id,
        fullName: user.profile?.fullName ?? null,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt.toISOString(),
      })),
    };
  }

  // Member Activity: per-day new signups and running member total over the
  // last `days` India-time days, from real users.createdAt values. Accounts
  // are never deleted (anonymization keeps the row), so the running total
  // ends at the same number as Total Members.
  async getMemberActivity(days: number, now = new Date()): Promise<MemberActivityResponse> {
    const { dates, start } = activityWindow(days, now);
    const [membersBeforeWindow, rows] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { lt: start } } }),
      // createdAt is stored in UTC; shifting by the fixed IST offset before
      // taking the date buckets each signup on its India calendar day.
      this.prisma.$queryRaw<{ day: string; count: number }[]>`
        SELECT to_char(("createdAt" + make_interval(mins => ${ACTIVITY_TZ_OFFSET_MINUTES}))::date, 'YYYY-MM-DD') AS day,
               count(*)::int AS count
        FROM users
        WHERE "createdAt" >= ${start}
        GROUP BY 1`,
    ]);
    const signupsByDay = new Map(rows.map((row) => [row.day, Number(row.count)]));
    return { days, timezone: 'Asia/Kolkata', points: buildActivitySeries(dates, membersBeforeWindow, signupsByDay) };
  }

  // FR-11.5. Needs an approved definition of "active subscription" and
  // refund-reporting scope before the aggregation query is meaningful —
  // tracked as an open decision, not a missing capability of this service.
  getFinanceDashboard(): never {
    throw new NotImplementedException('Finance dashboard aggregation is not yet defined');
  }

  // FR-11.6 (Could-have). No CMS content model exists yet.
  listCmsContent(): never {
    throw new NotImplementedException('CMS content management is not yet implemented');
  }
}
