import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { type RejectPhotoRequest, rejectPhotoRequestSchema } from '@nadar-kalyanam/schemas';
import { PERMISSIONS } from '../../common/permissions.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { HoroscopeService } from '../horoscope/horoscope.service.js';
import { PartnerPreferencesService } from '../partner-preferences/partner-preferences.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminService } from './admin.service.js';
import { AuditLogService } from './audit-log.service.js';
import { CurrentAdmin } from './decorators/current-admin.decorator.js';
import { RequirePermission } from './decorators/require-permission.decorator.js';
import { AdminAuthGuard, type AuthenticatedAdmin } from './guards/admin-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

// Member detail extras: partner preferences and horoscope, read-only, plus
// chart-image moderation. members.view is the existing full-profile
// permission (it already shows email, phone and date of birth), so it shows
// these in full; nothing here appears in the admin member LIST.
@Controller('admin')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminMemberExtrasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
    private readonly preferences: PartnerPreferencesService,
    private readonly horoscope: HoroscopeService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get('members/:userId/preferences-horoscope')
  @RequirePermission(PERMISSIONS.MEMBERS_VIEW)
  async preferencesAndHoroscope(@Param('userId') userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('This member has no profile');
    const [partnerPreferences, horoscope] = await Promise.all([this.preferences.findForUser(userId), this.horoscope.findByProfileId(profile.id)]);
    return {
      partnerPreferences,
      horoscope: horoscope ? await this.horoscope.toFull(horoscope) : null,
    };
  }

  // Same hold as photos: approve shows the chart to members the owner's
  // horoscope setting allows; reject (reason required) keeps it hidden and
  // tells the owner why.
  @Post('members/:userId/horoscope-chart/approve')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.MEMBERS_EDIT)
  async approveChart(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('userId') userId: string) {
    await this.adminService.assertMemberNotDeleted(userId, 'approve horoscope chart');
    const { profileId, chart } = await this.horoscope.moderateChart(userId, {
      approve: true,
    });
    await this.auditLog.record(admin.adminId, 'member.horoscope_chart.approve', 'Profile', profileId, { userId });
    return chart;
  }

  @Post('members/:userId/horoscope-chart/reject')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.MEMBERS_EDIT)
  async rejectChart(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(rejectPhotoRequestSchema))
    body: RejectPhotoRequest,
  ) {
    await this.adminService.assertMemberNotDeleted(userId, 'reject horoscope chart');
    const { profileId, chart } = await this.horoscope.moderateChart(userId, {
      approve: false,
      reason: body.reason,
    });
    await this.auditLog.record(admin.adminId, 'member.horoscope_chart.reject', 'Profile', profileId, { userId, reason: body.reason });
    return chart;
  }
}
