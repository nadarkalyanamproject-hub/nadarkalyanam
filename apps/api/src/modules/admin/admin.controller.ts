import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  type ResolveReportRequest,
  resolveReportRequestSchema,
  type SuspendMemberRequest,
  suspendMemberRequestSchema,
} from '@nadar-kalyanam/schemas';
import { parseOffsetLimit } from '../../common/pagination.js';
import { PERMISSIONS } from '../../common/permissions.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { AdminService } from './admin.service.js';
import { AuditLogService } from './audit-log.service.js';
import { CurrentAdmin } from './decorators/current-admin.decorator.js';
import { RequirePermission } from './decorators/require-permission.decorator.js';
import { AdminAuthGuard, type AuthenticatedAdmin } from './guards/admin-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

@Controller('admin')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly moderationService: ModerationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Post('members/:userId/suspend')
  @RequirePermission(PERMISSIONS.MEMBERS_SUSPEND)
  suspendMember(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(suspendMemberRequestSchema)) body: SuspendMemberRequest,
  ) {
    return this.adminService.suspendMember(admin.adminId, userId, body.reason);
  }

  @Post('members/:userId/reinstate')
  @RequirePermission(PERMISSIONS.MEMBERS_REINSTATE)
  reinstateMember(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('userId') userId: string) {
    return this.adminService.reinstateMember(admin.adminId, userId);
  }

  @Get('reports')
  @RequirePermission(PERMISSIONS.REPORTS_REVIEW)
  listReportQueue(@Query('offset') offsetParam?: string, @Query('limit') limitParam?: string) {
    const { offset, limit } = parseOffsetLimit(offsetParam, limitParam);
    return this.moderationService.listQueue(offset, limit);
  }

  @Patch('reports/:id')
  @RequirePermission(PERMISSIONS.REPORTS_REVIEW)
  async resolveReport(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resolveReportRequestSchema)) body: ResolveReportRequest,
  ) {
    const report = await this.moderationService.resolve(id, body.status);
    await this.auditLogService.record(admin.adminId, 'report.resolve', 'Report', id, { status: body.status });
    return report;
  }

  @Get('audit-logs')
  @RequirePermission(PERMISSIONS.ADMIN_USERS_MANAGE)
  listAuditLogs(@Query('offset') offsetParam?: string, @Query('limit') limitParam?: string) {
    const { offset, limit } = parseOffsetLimit(offsetParam, limitParam);
    return this.auditLogService.list(offset, limit);
  }

  @Get('finance/dashboard')
  @RequirePermission(PERMISSIONS.FINANCE_DASHBOARD_VIEW)
  getFinanceDashboard() {
    return this.adminService.getFinanceDashboard();
  }
}
