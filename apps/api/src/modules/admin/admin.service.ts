import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditLogService } from './audit-log.service.js';

// FR-9.5 / FR-11.4: suspend/reinstate are reachable by both Moderator and
// Super Admin per the use case diagram's reading note — the permission table
// (not this service) is what actually restricts who may call it.
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

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
