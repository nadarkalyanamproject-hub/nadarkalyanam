import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

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

  list(offset: number, limit: number) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });
  }
}
