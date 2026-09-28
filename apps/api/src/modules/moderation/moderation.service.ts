import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ReportResponse, ReportStatus } from '@nadar-kalyanam/schemas';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function toReportResponse(report: {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
}): ReportResponse {
  return {
    id: report.id,
    reporterId: report.reporterId,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    status: report.status as ReportResponse['status'],
    createdAt: report.createdAt.toISOString(),
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
  };
}

export interface ReportMemberSummary {
  userId: string;
  profileId: string | null;
  fullName: string | null;
  phoneNumber: string;
  status: string;
}

// The admin queue's view of a report: the raw row plus who filed it and who
// it's about, resolved from the loose ids on Report (it has no foreign keys:
// reporterId is a User id; targetId is a Profile id for PROFILE reports and
// a Message id for MESSAGE reports — see the web app's report form). For a
// MESSAGE report, reportedMember is the message's sender.
export interface AdminReportView extends ReportResponse {
  reporter: ReportMemberSummary | null;
  reportedMember: ReportMemberSummary | null;
  reportedMessage: { id: string; body: string; createdAt: string } | null;
}

const OPEN_STATUSES: ReportStatus[] = ['OPEN', 'IN_REVIEW'];

// Allowed moves. IN_REVIEW only from OPEN; closing (RESOLVED/DISMISSED) from
// either open state. Closed reports are final — re-deciding one would
// overwrite resolvedAt and lose what the original decision was.
const ALLOWED_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  OPEN: ['IN_REVIEW', 'RESOLVED', 'DISMISSED'],
  IN_REVIEW: ['RESOLVED', 'DISMISSED'],
  RESOLVED: [],
  DISMISSED: [],
};

// FR-9: blocks and reports are user-scoped account-level trust decisions
// (Fig 1c), not profile-scoped — see PROFILES vs USERS in the ER diagram.
@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async block(callerUserId: string, targetUserId: string): Promise<{ id: string }> {
    if (callerUserId === targetUserId) {
      throw new BadRequestException('You cannot block yourself');
    }
    try {
      const block = await this.prisma.block.create({
        data: { initiatorId: callerUserId, targetId: targetUserId },
      });
      return { id: block.id };
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('You have already blocked this member');
      }
      throw error;
    }
  }

  async report(
    reporterUserId: string,
    targetType: 'PROFILE' | 'MESSAGE',
    targetId: string,
    reason: string,
  ): Promise<ReportResponse> {
    const report = await this.prisma.report.create({
      data: { reporterId: reporterUserId, targetType, targetId, reason },
    });
    return toReportResponse(report);
  }

  // FR-9.3: reports route into a moderator review queue tracked by status —
  // "queue" here is a query filter (OPEN/IN_REVIEW first), not a message
  // queue; SLA timing against createdAt is left to the moderation dashboard.
  async listQueue(offset: number, limit: number): Promise<{ items: ReportResponse[] }> {
    const reports = await this.prisma.report.findMany({
      where: { status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
    });
    return { items: reports.map(toReportResponse) };
  }

  // Admin queue with context. No status = the open queue (oldest first, as
  // listQueue); a closed status lists most recent first. Related rows are
  // fetched in one batched query per kind rather than per report.
  async listForAdmin(
    status: ReportStatus | undefined,
    offset: number,
    limit: number,
  ): Promise<{ items: AdminReportView[]; total: number }> {
    const where = status ? { status } : { status: { in: OPEN_STATUSES } };
    const isOpenView = !status || OPEN_STATUSES.includes(status);
    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: isOpenView ? 'asc' : 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    const profileTargetIds = reports.filter((r) => r.targetType === 'PROFILE').map((r) => r.targetId);
    const messageTargetIds = reports.filter((r) => r.targetType === 'MESSAGE').map((r) => r.targetId);

    const [targetProfiles, targetMessages] = await Promise.all([
      profileTargetIds.length
        ? this.prisma.profile.findMany({ where: { id: { in: profileTargetIds } }, select: { id: true, userId: true } })
        : Promise.resolve([]),
      messageTargetIds.length
        ? this.prisma.message.findMany({
            where: { id: { in: messageTargetIds } },
            select: { id: true, senderId: true, body: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

    const userIds = new Set<string>(reports.map((r) => r.reporterId));
    targetProfiles.forEach((p) => userIds.add(p.userId));
    targetMessages.forEach((m) => userIds.add(m.senderId));

    const users = userIds.size
      ? await this.prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: {
            id: true,
            phoneNumber: true,
            status: true,
            profile: { select: { id: true, fullName: true } },
          },
        })
      : [];
    const usersById = new Map(
      users.map((u): [string, ReportMemberSummary] => [
        u.id,
        {
          userId: u.id,
          profileId: u.profile?.id ?? null,
          fullName: u.profile?.fullName ?? null,
          phoneNumber: u.phoneNumber,
          status: u.status,
        },
      ]),
    );
    const profileOwner = new Map(targetProfiles.map((p) => [p.id, p.userId]));
    const messagesById = new Map(targetMessages.map((m) => [m.id, m]));

    const items = reports.map((report): AdminReportView => {
      const message = report.targetType === 'MESSAGE' ? messagesById.get(report.targetId) : undefined;
      const reportedUserId =
        report.targetType === 'PROFILE' ? profileOwner.get(report.targetId) : message?.senderId;
      return {
        ...toReportResponse(report),
        reporter: usersById.get(report.reporterId) ?? null,
        reportedMember: reportedUserId ? (usersById.get(reportedUserId) ?? null) : null,
        reportedMessage: message
          ? { id: message.id, body: message.body, createdAt: message.createdAt.toISOString() }
          : null,
      };
    });

    return { items, total };
  }

  async updateStatus(reportId: string, status: 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'): Promise<ReportResponse> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    const from = report.status as ReportStatus;
    if (!ALLOWED_TRANSITIONS[from].includes(status)) {
      throw new ConflictException(`Cannot move a report from ${from} to ${status}`);
    }
    // Conditional on the status just read, so two moderators acting on the
    // same report at once can't both succeed.
    const { count } = await this.prisma.report.updateMany({
      where: { id: reportId, status: from },
      data: { status, resolvedAt: status === 'IN_REVIEW' ? null : new Date() },
    });
    if (count === 0) {
      throw new ConflictException('Report was updated by someone else; reload and try again');
    }
    const updated = await this.prisma.report.findUniqueOrThrow({ where: { id: reportId } });
    return toReportResponse(updated);
  }
}
