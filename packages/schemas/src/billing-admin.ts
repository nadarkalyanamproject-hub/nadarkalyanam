import { z } from 'zod';
import { orderStatusEnum } from './payments.js';

// --- Admin: plans ---------------------------------------------------------

// PATCH /admin/plans/:id. Only display/pricing fields; code, duration and
// limits are fixed (changing entitlements means a new plan). Changes apply
// to new orders only — existing orders keep their recorded amount.
export const updatePlanRequestSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(60).optional(),
    priceInPaise: z.number().int('Price must be whole paise').positive('Price must be more than 0').optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to change' });
export type UpdatePlanRequest = z.infer<typeof updatePlanRequestSchema>;

// --- Admin: subscriptions -------------------------------------------------

// Derived from dates: CANCELLED (cancelledAt set), EXPIRED (ended), QUEUED
// (paid/granted, starts later), ACTIVE (running now).
export const subscriptionStateEnum = z.enum(['ACTIVE', 'QUEUED', 'EXPIRED', 'CANCELLED']);
export type SubscriptionState = z.infer<typeof subscriptionStateEnum>;
export const subscriptionSourceEnum = z.enum(['PAYMENT', 'ADMIN_GRANT']);
export type SubscriptionSource = z.infer<typeof subscriptionSourceEnum>;

export const adminSubscriptionsQuerySchema = z.object({
  state: subscriptionStateEnum.optional(),
  planCode: z.string().optional(),
  source: subscriptionSourceEnum.optional(),
  search: z.string().trim().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminSubscriptionsQuery = z.infer<typeof adminSubscriptionsQuerySchema>;

const reason = z.string().trim().min(3, 'Please give a reason (at least 3 characters)').max(500);

export const grantSubscriptionRequestSchema = z.object({
  memberId: z.string().min(1),
  planId: z.string().min(1),
  durationDays: z.number().int().min(1).max(1095).optional(),
  reason,
  paymentReference: z.string().trim().max(200).optional(),
});
export type GrantSubscriptionRequest = z.infer<typeof grantSubscriptionRequestSchema>;

export const reasonRequestSchema = z.object({ reason });
export type ReasonRequest = z.infer<typeof reasonRequestSchema>;

// --- Admin: orders --------------------------------------------------------

export const adminOrdersQuerySchema = z.object({
  status: orderStatusEnum.optional(),
  // India-time calendar dates, inclusive.
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().max(100).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminOrdersQuery = z.infer<typeof adminOrdersQuerySchema>;

// --- Admin: finance -------------------------------------------------------

export const financeDashboardQuerySchema = z.object({
  days: z.coerce.number().pipe(z.union([z.literal(7), z.literal(30), z.literal(90)])).default(30),
});
export type FinanceDashboardQuery = z.infer<typeof financeDashboardQuerySchema>;

// --- VIP enquiries --------------------------------------------------------

export const vipEnquiryStatusEnum = z.enum(['NEW', 'CONTACTED', 'ONBOARDED', 'CLOSED']);
export type VipEnquiryStatus = z.infer<typeof vipEnquiryStatusEnum>;

// POST /vip-enquiries. Name and phone come from the member's own account.
export const createVipEnquiryRequestSchema = z.object({
  message: z.string().trim().max(1000).optional(),
});
export type CreateVipEnquiryRequest = z.infer<typeof createVipEnquiryRequestSchema>;

export const vipEnquiryResponseSchema = z.object({
  id: z.string(),
  status: vipEnquiryStatusEnum,
  message: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type VipEnquiryResponse = z.infer<typeof vipEnquiryResponseSchema>;

export const myVipEnquiryResponseSchema = z.object({ enquiry: vipEnquiryResponseSchema.nullable() });
export type MyVipEnquiryResponse = z.infer<typeof myVipEnquiryResponseSchema>;

export const adminVipEnquiriesQuerySchema = z.object({
  status: vipEnquiryStatusEnum.optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminVipEnquiriesQuery = z.infer<typeof adminVipEnquiriesQuerySchema>;

export const updateVipEnquiryRequestSchema = z
  .object({
    status: vipEnquiryStatusEnum.optional(),
    assignedAdminId: z.string().min(1).nullable().optional(),
    adminNotes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to change' });
export type UpdateVipEnquiryRequest = z.infer<typeof updateVipEnquiryRequestSchema>;
