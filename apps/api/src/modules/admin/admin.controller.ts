import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { revokeSession } from '../auth/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type RecentActivityQuery,
  recentActivityQuerySchema,
  type MemberActivityQuery,
  memberActivityQuerySchema,
  type AdminAuditLogsQuery,
  adminAuditLogsQuerySchema,
  type AdminMembersQuery,
  adminMembersQuerySchema,
  type AdminReportsQuery,
  adminReportsQuerySchema,
  type CreateAdminRequest,
  createAdminRequestSchema,
  type CreateProfileRequest,
  createProfileSchema,
  type RemoveMemberPhotoRequest,
  removeMemberPhotoRequestSchema,
  type RemoveMemberRequest,
  removeMemberRequestSchema,
  type ResolveReportRequest,
  resolveReportRequestSchema,
  type SuspendMemberRequest,
  suspendMemberRequestSchema,
  type UpdateAdminRequest,
  updateAdminRequestSchema,
} from '@nadar-kalyanam/schemas';
import { parseOffsetLimit } from '../../common/pagination.js';
import { PERMISSIONS } from '../../common/permissions.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ModerationService } from '../moderation/moderation.service.js';
import { ProfilesService } from '../profiles/profiles.service.js';
import { AdminUsersService } from './admin-users.service.js';
import { AdminService } from './admin.service.js';
import { AuditLogService } from './audit-log.service.js';
import { loadRecentActivity } from './recent-activity.js';
import { CurrentAdmin } from './decorators/current-admin.decorator.js';
import { RequirePermission } from './decorators/require-permission.decorator.js';
import { AdminAuthGuard, type AuthenticatedAdmin } from './guards/admin-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

@Controller('admin')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminUsersService: AdminUsersService,
    private readonly moderationService: ModerationService,
    private readonly profilesService: ProfilesService,
    private readonly auditLogService: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  // The signed-in admin's own identity and resolved permission codes, so the
  // admin UI can show only the sections this admin can actually use. No
  // @RequirePermission: any active admin may read their own record
  // (AdminAuthGuard still applies).
  @Get('me')
  getMe(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.adminUsersService.getCurrentAdmin(admin);
  }

  // Admin logout: revokes this login session exactly like member logout
  // (POST /auth/logout), so this admin token stops working at once. Any
  // active admin may log themselves out — no permission required.
  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentAdmin() admin: AuthenticatedAdmin): Promise<void> {
    await revokeSession(this.prisma, admin.userId, admin.sessionId);
  }

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

  // Member Activity chart: per-day signups and running member total for the
  // last 7, 30 or 90 days. Same permission as the dashboard itself.
  @Get('dashboard/activity')
  @RequirePermission(PERMISSIONS.MEMBERS_VIEW)
  getMemberActivity(@Query(new ZodValidationPipe(memberActivityQuerySchema)) query: MemberActivityQuery) {
    return this.adminService.getMemberActivity(query.days);
  }

  // Recent Activity feed. Same permission as the dashboard; which sources
  // appear depends on this admin's permissions (see loadRecentActivity).
  @Get('dashboard/recent-activity')
  @RequirePermission(PERMISSIONS.MEMBERS_VIEW)
  async getRecentActivity(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Query(new ZodValidationPipe(recentActivityQuerySchema)) query: RecentActivityQuery,
  ) {
    return { items: await loadRecentActivity(this.prisma, admin, query.limit) };
  }

  @Get('members')
  @RequirePermission(PERMISSIONS.MEMBERS_VIEW)
  listMembers(@Query(new ZodValidationPipe(adminMembersQuerySchema)) query: AdminMembersQuery) {
    const { offset, limit } = parseOffsetLimit(query.offset, query.limit);
    return this.adminService.listMembers(offset, limit, query.search || undefined, {
      status: query.status,
      verified: query.verified === undefined ? undefined : query.verified === 'true',
      sort: query.sort,
    });
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
    await this.adminService.assertMemberNotDeleted(userId, 'edit profile');
    const profile = await this.profilesService.updateProfile(userId, body);
    await this.auditLogService.record(admin.adminId, 'member.profile.update', 'Profile', profile.id, { userId });
    return profile;
  }

  @Delete('members/:userId/photos/:photoId')
  @RequirePermission(PERMISSIONS.MEMBERS_EDIT)
  removeMemberPhoto(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('userId') userId: string,
    @Param('photoId') photoId: string,
    @Body(new ZodValidationPipe(removeMemberPhotoRequestSchema)) body: RemoveMemberPhotoRequest,
  ) {
    return this.adminService.removeMemberPhoto(admin.adminId, userId, photoId, body.reason);
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

  // Cancelling a removal is gated by the same permission as starting one:
  // whoever may schedule an anonymization may also call it off.
  @Post('members/:userId/restore')
  @RequirePermission(PERMISSIONS.MEMBERS_REMOVE)
  restoreMember(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('userId') userId: string) {
    return this.adminService.restoreMember(admin.adminId, userId);
  }

  @Get('reports')
  @RequirePermission(PERMISSIONS.REPORTS_REVIEW)
  async listReportQueue(@Query(new ZodValidationPipe(adminReportsQuerySchema)) query: AdminReportsQuery) {
    const { offset, limit } = parseOffsetLimit(query.offset, query.limit);
    const { items, total } = await this.moderationService.listForAdmin(query.status, offset, limit);
    const notes = await this.auditLogService.latestReportNotes(items.map((item) => item.id));
    return { items: items.map((item) => ({ ...item, note: notes.get(item.id) ?? null })), total };
  }

  // IN_REVIEW ("picked up"), RESOLVED or DISMISSED, with an optional note
  // kept on the audit entry (Report has no note column).
  @Patch('reports/:id')
  @RequirePermission(PERMISSIONS.REPORTS_REVIEW)
  async updateReport(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resolveReportRequestSchema)) body: ResolveReportRequest,
  ) {
    const report = await this.moderationService.updateStatus(id, body.status);
    const action = body.status === 'IN_REVIEW' ? 'report.review' : 'report.resolve';
    await this.auditLogService.record(admin.adminId, action, 'Report', id, {
      status: body.status,
      ...(body.note ? { note: body.note } : {}),
    });
    return report;
  }

  @Get('audit-logs')
  @RequirePermission(PERMISSIONS.ADMIN_USERS_MANAGE)
  listAuditLogs(@Query(new ZodValidationPipe(adminAuditLogsQuerySchema)) query: AdminAuditLogsQuery) {
    const { offset, limit } = parseOffsetLimit(query.offset, query.limit);
    return this.auditLogService.list(offset, limit, {
      action: query.action,
      adminId: query.adminId,
      targetType: query.targetType,
      targetId: query.targetId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  // --- Admin user management (FR-11.3) ---------------------------------
  // Gated by the pre-existing admin_users.manage code (SUPER_ADMIN only in
  // seed.ts), which already existed for exactly this capability.

  @Get('admins')
  @RequirePermission(PERMISSIONS.ADMIN_USERS_MANAGE)
  listAdmins() {
    return this.adminUsersService.listAdmins();
  }

  @Get('roles')
  @RequirePermission(PERMISSIONS.ADMIN_USERS_MANAGE)
  listRoles() {
    return this.adminUsersService.listRoles();
  }

  @Post('admins')
  @RequirePermission(PERMISSIONS.ADMIN_USERS_MANAGE)
  createAdmin(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(createAdminRequestSchema)) body: CreateAdminRequest,
  ) {
    return this.adminUsersService.createAdmin(admin.adminId, body);
  }

  @Patch('admins/:id')
  @RequirePermission(PERMISSIONS.ADMIN_USERS_MANAGE)
  updateAdmin(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAdminRequestSchema)) body: UpdateAdminRequest,
  ) {
    return this.adminUsersService.updateAdmin(admin, id, body);
  }

  @Get('finance/dashboard')
  @RequirePermission(PERMISSIONS.FINANCE_DASHBOARD_VIEW)
  getFinanceDashboard() {
    return this.adminService.getFinanceDashboard();
  }
}
