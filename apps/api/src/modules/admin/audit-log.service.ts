import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditLogFilters {
  action?: string;
  adminId?: string;
  targetType?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
}

// NFR-4.7 / FR-11.4: every sensitive admin action produces an immutable audit
// log entry. Exported so other modules (moderation, verification, payments)
// can record actions taken by an admin without importing all of AdminModule.
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  record(adminId: string, action: string, targetType: string, targetId: string, metadata: Record<string, unknown> = {}) {
    return this.prisma.auditLog.create({
      data: { adminId, action, targetType, targetId, metadata: metadata as Prisma.InputJsonValue },
    });
  }

  // `from`/`to` are inclusive bounds on createdAt. The actor's email/phone
  // are joined in so the UI can show who acted, not just an AdminUser id.
  async list(offset: number, limit: number, filters: AuditLogFilters = {}) {
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.adminId ? { adminId: filters.adminId } : {}),
      ...(filters.targetType ? { targetType: filters.targetType } : {}),
      ...(filters.targetId ? { targetId: filters.targetId } : {}),
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    };

    const [entries, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: { admin: { select: { email: true, user: { select: { phoneNumber: true } } } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: entries.map((entry) => ({
        id: entry.id,
        adminId: entry.adminId,
        adminEmail: entry.admin.email,
        adminPhoneNumber: entry.admin.user.phoneNumber,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata,
        createdAt: entry.createdAt.toISOString(),
      })),
      total,
    };
  }

  // Report has no column for a moderator's note, so the note lives in the
  // audit entry the status change writes. This returns the most recent
  // non-empty note per report id.
  async latestReportNotes(reportIds: string[]): Promise<Map<string, string>> {
    if (reportIds.length === 0) return new Map();
    const entries = await this.prisma.auditLog.findMany({
      where: { targetType: 'Report', targetId: { in: reportIds }, action: { in: ['report.review', 'report.resolve'] } },
      orderBy: { createdAt: 'desc' },
      select: { targetId: true, metadata: true },
    });
    const notes = new Map<string, string>();
    for (const entry of entries) {
      const note = (entry.metadata as { note?: unknown } | null)?.note;
      if (typeof note === 'string' && note && !notes.has(entry.targetId)) {
        notes.set(entry.targetId, note);
      }
    }
    return notes;
  }
}
