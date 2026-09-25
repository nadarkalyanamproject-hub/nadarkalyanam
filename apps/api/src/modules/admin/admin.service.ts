import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PhotosService } from '../photos/photos.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from './audit-log.service.js';

// 14 days, matching FR-1.5's self-service account-deletion grace period —
// admin-initiated removal is the same underlying mechanism, just triggered
// by an admin instead of the member themselves. There is deliberately no
// separate "scheduled anonymization" field: deletionRequestedAt + this
// window IS the scheduled date, computed wherever it's needed.
const DELETION_GRACE_PERIOD_DAYS = 14;

function scheduledAnonymizationDate(deletionRequestedAt: Date): Date {
  return new Date(deletionRequestedAt.getTime() + DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
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
  ) {}

  // FR-11.1/11.2: basic search by phone, name, or email so an admin can
  // actually find someone to act on. Queries User (not Profile) as the base
  // entity — a member who registered but never finished onboarding still
  // has no Profile row and must still be findable/actionable.
  async listMembers(offset: number, limit: number, search?: string) {
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { phoneNumber: { contains: search, mode: 'insensitive' } },
            { profile: { fullName: { contains: search, mode: 'insensitive' } } },
            { profile: { details: { path: ['email'], string_contains: search } } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { profile: { select: { id: true, fullName: true, completionScore: true, isVerified: true } } },
        orderBy: { createdAt: 'desc' },
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

  async suspendMember(adminId: string, userId: string, reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Member not found');
    }
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
    await this.auditLog.record(adminId, 'member.suspend', 'User', userId, { reason });
    return { id: updated.id, status: updated.status };
  }

  async reinstateMember(adminId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Member not found');
    }
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
    await this.auditLog.record(adminId, 'member.reinstate', 'User', userId, {});
    return { id: updated.id, status: updated.status };
  }

  // FR-1.5's grace-period-then-anonymize deletion, admin-initiated instead
  // of self-initiated — the SAME state transition self-service deletion
  // would use, not a separate mechanism. Setting status away from ACTIVE
  // already has a real, immediate effect: discovery/matching/messaging all
  // filter on user.status === 'ACTIVE', so this member drops out of search
  // and recommendations right away. What's deliberately NOT built here: a
  // background job that actually performs the anonymization once the grace
  // period elapses — that's real, separate follow-up work, not a no-op.
  async removeMember(adminId: string, userId: string, reason: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Member not found');
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
    return {
      id: updated.id,
      status: updated.status,
      deletionRequestedAt: deletionRequestedAt.toISOString(),
      scheduledAnonymizationAt: scheduledAt.toISOString(),
    };
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
