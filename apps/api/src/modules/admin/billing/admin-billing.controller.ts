import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  type AdminOrdersQuery,
  adminOrdersQuerySchema,
  type AdminSubscriptionsQuery,
  adminSubscriptionsQuerySchema,
  type AddVipNoteRequest,
  addVipNoteRequestSchema,
  type AdminVipEnquiriesQuery,
  adminVipEnquiriesQuerySchema,
  type FinanceDashboardQuery,
  financeDashboardQuerySchema,
  type GrantSubscriptionRequest,
  grantSubscriptionRequestSchema,
  type ReasonRequest,
  reasonRequestSchema,
  type UpdatePlanRequest,
  updatePlanRequestSchema,
  type UpdateVipEnquiryRequest,
  updateVipEnquiryRequestSchema,
} from '@nadar-kalyanam/schemas';
import { parseOffsetLimit } from '../../../common/pagination.js';
import { PERMISSIONS } from '../../../common/permissions.js';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { VipEnquiriesService } from '../../vip/vip-enquiries.service.js';
import { AuditLogService } from '../audit-log.service.js';
import { CurrentAdmin } from '../decorators/current-admin.decorator.js';
import { RequirePermission } from '../decorators/require-permission.decorator.js';
import { AdminAuthGuard, type AuthenticatedAdmin } from '../guards/admin-auth.guard.js';
import { PermissionsGuard } from '../guards/permissions.guard.js';
import { AdminBillingService } from './admin-billing.service.js';
import { buildFinanceDashboard } from './finance-dashboard.js';

// Plans, subscriptions, orders/refunds, the finance dashboard and VIP
// enquiries. Every route needs its own permission; every write is audited.
@Controller('admin')
@UseGuards(AdminAuthGuard, PermissionsGuard)
export class AdminBillingController {
  constructor(
    private readonly billing: AdminBillingService,
    private readonly vip: VipEnquiriesService,
    private readonly auditLog: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  // --- Plans ---------------------------------------------------------------

  @Get('plans')
  @RequirePermission(PERMISSIONS.PLANS_MANAGE)
  listPlans() {
    return this.billing.listPlans();
  }

  @Patch('plans/:id')
  @RequirePermission(PERMISSIONS.PLANS_MANAGE)
  updatePlan(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePlanRequestSchema)) body: UpdatePlanRequest,
  ) {
    return this.billing.updatePlan(admin.adminId, id, body);
  }

  // --- Subscriptions -----------------------------------------------------------

  @Get('subscriptions')
  @RequirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE)
  listSubscriptions(@Query(new ZodValidationPipe(adminSubscriptionsQuerySchema)) query: AdminSubscriptionsQuery) {
    return this.billing.listSubscriptions(query);
  }

  @Post('subscriptions/grant')
  @RequirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE)
  grantSubscription(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(grantSubscriptionRequestSchema)) body: GrantSubscriptionRequest,
  ) {
    return this.billing.grant(admin.adminId, body);
  }

  @Get('subscriptions/:id')
  @RequirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE)
  getSubscription(@Param('id') id: string) {
    return this.billing.getSubscription(id);
  }

  @Post('subscriptions/:id/cancel')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE)
  cancelSubscription(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reasonRequestSchema)) body: ReasonRequest,
  ) {
    return this.billing.cancel(admin.adminId, id, body.reason);
  }

  // Member detail page: plans, unlock and interest usage, recent orders.
  @Get('members/:userId/membership')
  @RequirePermission(PERMISSIONS.MEMBERS_VIEW)
  memberMembership(@Param('userId') userId: string) {
    return this.billing.memberMembership(userId);
  }

  // Read-only phone-unlock usage; names and dates only, never numbers.
  @Get('members/:userId/phone-unlocks')
  @RequirePermission(PERMISSIONS.MEMBERS_VIEW)
  memberPhoneUnlocks(@Param('userId') userId: string, @Query('offset') offset?: string, @Query('limit') limit?: string) {
    const page = parseOffsetLimit(offset, limit, 50);
    return this.billing.memberPhoneUnlocks(userId, page.offset, page.limit);
  }

  // --- Orders -------------------------------------------------------------------

  @Get('orders')
  @RequirePermission(PERMISSIONS.FINANCE_DASHBOARD_VIEW)
  listOrders(@Query(new ZodValidationPipe(adminOrdersQuerySchema)) query: AdminOrdersQuery) {
    return this.billing.listOrders(query);
  }

  @Get('orders/attention')
  @RequirePermission(PERMISSIONS.FINANCE_DASHBOARD_VIEW)
  ordersNeedingAttention() {
    return this.billing.attention();
  }

  @Get('orders/:id')
  @RequirePermission(PERMISSIONS.FINANCE_DASHBOARD_VIEW)
  getOrder(@Param('id') id: string) {
    return this.billing.getOrder(id);
  }

  @Post('orders/:id/activate')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.SUBSCRIPTIONS_MANAGE)
  activateOrder(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id') id: string) {
    return this.billing.activateOrder(admin.adminId, id);
  }

  // Records the refund only; the money is returned in the payment gateway.
  @Post('orders/:id/refund')
  @HttpCode(200)
  @RequirePermission(PERMISSIONS.PAYMENTS_REFUND)
  refundOrder(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reasonRequestSchema)) body: ReasonRequest,
  ) {
    return this.billing.refund(admin.adminId, id, body.reason);
  }

  // --- Finance ------------------------------------------------------------------

  @Get('finance/dashboard')
  @RequirePermission(PERMISSIONS.FINANCE_DASHBOARD_VIEW)
  getFinanceDashboard(@Query(new ZodValidationPipe(financeDashboardQuerySchema)) query: FinanceDashboardQuery) {
    return buildFinanceDashboard(this.prisma, query.days);
  }

  // --- VIP enquiries --------------------------------------------------------------

  @Get('vip-enquiries')
  @RequirePermission(PERMISSIONS.VIP_MANAGE)
  listVipEnquiries(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Query(new ZodValidationPipe(adminVipEnquiriesQuerySchema)) query: AdminVipEnquiriesQuery,
  ) {
    return this.vip.list({ status: query.status, assignee: query.assignee, callerAdminId: admin.adminId }, query.offset, query.limit);
  }

  @Get('vip-enquiries/assignees')
  @RequirePermission(PERMISSIONS.VIP_MANAGE)
  vipAssignees() {
    return this.vip.assignees();
  }

  // Detail: notes and status/assignment history (admin-only).
  @Get('vip-enquiries/:id')
  @RequirePermission(PERMISSIONS.VIP_MANAGE)
  getVipEnquiry(@Param('id') id: string) {
    return this.vip.getForAdmin(id);
  }

  @Post('vip-enquiries/:id/notes')
  @RequirePermission(PERMISSIONS.VIP_MANAGE)
  async addVipNote(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addVipNoteRequestSchema)) body: AddVipNoteRequest,
  ) {
    const { enquiry, note } = await this.vip.addNote(admin.adminId, id, body.body);
    await this.auditLog.record(admin.adminId, 'vip.note', 'VipEnquiry', id, { userId: enquiry.userId, noteId: note.id });
    return this.vip.getForAdmin(id);
  }

  @Patch('vip-enquiries/:id')
  @RequirePermission(PERMISSIONS.VIP_MANAGE)
  async updateVipEnquiry(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateVipEnquiryRequestSchema)) body: UpdateVipEnquiryRequest,
  ) {
    const { enquiry, events } = await this.vip.update(admin.adminId, id, body);
    for (const event of events) {
      await this.auditLog.record(admin.adminId, event.kind === 'STATUS' ? 'vip.status' : 'vip.assign', 'VipEnquiry', id, {
        userId: enquiry.userId,
        before: event.fromValue,
        after: event.toValue,
      });
    }
    return this.vip.getForAdmin(id);
  }
}
