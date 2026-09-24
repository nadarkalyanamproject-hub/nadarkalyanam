import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ReportResponse } from '@nadar-kalyanam/schemas';
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
      where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
    });
    return { items: reports.map(toReportResponse) };
  }

  async resolve(reportId: string, status: 'RESOLVED' | 'DISMISSED'): Promise<ReportResponse> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: { status, resolvedAt: new Date() },
    });
    return toReportResponse(updated);
  }
}
