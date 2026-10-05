import { z } from 'zod';

export const membershipPlanCodeEnum = z.enum(['GOLD', 'GOLD_PLUS', 'GOLD_PREMIUM', 'VIP_ASSISTED']);
export type MembershipPlanCode = z.infer<typeof membershipPlanCodeEnum>;

// One line of a plan's feature list. `available: false` means the product
// can't deliver it yet; the UI marks it Coming Soon.
export const planFeatureSchema = z.object({
  key: z.string(),
  label: z.string(),
  available: z.boolean(),
});
export type PlanFeature = z.infer<typeof planFeatureSchema>;

export const membershipPlanResponseSchema = z.object({
  id: z.string(),
  // A plan's code is stable; it may be a non-standard string for a plan
  // added outside the four seeded ones.
  code: z.string(),
  name: z.string(),
  priceInPaise: z.number(),
  durationDays: z.number(),
  sortOrder: z.number(),
  // null = unlimited.
  phoneUnlockLimit: z.number().nullable(),
  isAssisted: z.boolean(),
  features: z.array(planFeatureSchema),
});
export type MembershipPlanResponse = z.infer<typeof membershipPlanResponseSchema>;

export const createOrderRequestSchema = z.object({
  planId: z.string().min(1, 'planId is required'),
});
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;

export const orderStatusEnum = z.enum(['CREATED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED']);
export type OrderStatus = z.infer<typeof orderStatusEnum>;

export const orderResponseSchema = z.object({
  id: z.string(),
  planId: z.string(),
  amountInPaise: z.number(),
  status: orderStatusEnum,
  createdAt: z.string(),
});
export type OrderResponse = z.infer<typeof orderResponseSchema>;

// The provider-agnostic webhook envelope. amountInPaise/currency must match
// the order exactly or the event is rejected.
export const paymentWebhookEventSchema = z.object({
  providerEventId: z.string().min(1),
  orderId: z.string().min(1),
  status: z.enum(['PAID', 'FAILED', 'CANCELLED', 'REFUNDED']),
  amountInPaise: z.number().int().nonnegative(),
  currency: z.string().min(1),
});
export type PaymentWebhookEventInput = z.infer<typeof paymentWebhookEventSchema>;

export const paymentHistoryItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  status: orderStatusEnum,
  createdAt: z.string(),
});
export type PaymentHistoryItem = z.infer<typeof paymentHistoryItemSchema>;

// GET /me/membership. plan is null for a free member.
export const myMembershipResponseSchema = z.object({
  plan: z
    .object({
      code: z.string(),
      name: z.string(),
      isAssisted: z.boolean(),
      phoneUnlockLimit: z.number().nullable(),
    })
    .nullable(),
  status: z.enum(['ACTIVE', 'FREE']),
  // End of the current subscription.
  expiresAt: z.string().nullable(),
  // End of the last already-paid renewal (equals expiresAt when none).
  paidThroughAt: z.string().nullable(),
});
export type MyMembershipResponse = z.infer<typeof myMembershipResponseSchema>;
