import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  type CreateProfileRequest,
  createProfileSchema,
  type RemoveMemberRequest,
  removeMemberRequestSchema,
  type ResolveReportRequest,
  resolveReportRequestSchema,
  type SuspendMemberRequest,
  suspendMemberRequestSchema,
} from '@nadar-kalyanam/schemas';
import { parseOffsetLimit } from '../../common/pagination.js';
import { PERMISSIONS } from '../../common/permissions.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
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
    private readonly profilesService: ProfilesService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // Reuses MEMBERS_VIEW rather than a new "dashboard.view" code: this is a
  // platform-overview page built mostly from member data (with a bare
  // report count folded in for glanceability, not report content/detail),
  // and every role that can see Members (SUPER_ADMIN, MODERATOR) already
  // holds MEMBERS_VIEW — see prisma/seed.ts's ROLE_PERMISSIONS.
  @Get('dashboard')
  @RequirePermission(PERMISSIONS.MEMBERS_VIEW)
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('members')
  @RequirePermission(PERMISSIONS.MEMBERS_VIEW)
  listMembers(
    @Query('offset') offsetParam?: string,
    @Query('limit') limitParam?: string,
    @Query('search') search?: string,
  ) {
    const { offset, limit } = parseOffsetLimit(offsetParam, limitParam);
    return this.adminService.listMembers(offset, limit, search);
  }

  @Get('members/:userId')
  @RequirePermission(PERMISSIONS.MEMBERS_VIEW)
  getMember(@Param('userId') userId: string) {
    return this.adminService.getMemberDetail(userId);
  }

  // Reuses the exact same Zod schema PATCH /profiles/me validates against —
  // an admin correcting a member's profile is held to the same data-shape
  // rules as the member themselves, not a looser admin-only validation path.
  @Patch('members/:userId/profile')
  @RequirePermission(PERMISSIONS.MEMBERS_EDIT)
  async updateMemberProfile(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(createProfileSchema)) body: CreateProfileRequest,
  ) {
    const profile = await this.profilesService.updateProfile(userId, body);
    await this.auditLogService.record(admin.adminId, 'member.profile.update', 'Profile', profile.id, {});
    return profile;
  }

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

  // Grace-period removal (FR-1.5's mechanism, admin-initiated) — not
  // immediate hard deletion. See AdminService.removeMember.
  @Post('members/:userId/remove')
  @RequirePermission(PERMISSIONS.MEMBERS_REMOVE)
  removeMember(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(removeMemberRequestSchema)) body: RemoveMemberRequest,
  ) {
    return this.adminService.removeMember(admin.adminId, userId, body.reason);
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
