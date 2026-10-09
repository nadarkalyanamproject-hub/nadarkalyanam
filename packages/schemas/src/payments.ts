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
  description: z.string().nullable(),
  priceInPaise: z.number(),
  // The "was" price shown struck out (always more than priceInPaise), or
  // null for no discount. Display only — orders charge priceInPaise.
  originalPriceInPaise: z.number().nullable(),
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

// GET /me/membership — the member's own view only (never shown to others).
// plan is null for a free member.
const memberPlanStatusEnum = z.enum(['ACTIVE', 'QUEUED', 'EXPIRED', 'CANCELLED']);

export const membershipHistoryItemSchema = z.object({
  planCode: z.string(),
  planName: z.string(),
  startedAt: z.string(),
  // When it ended or will end (cancelledAt for a cancelled plan).
  endsAt: z.string(),
  // How the member got it. Admin identity, reasons and notes are never sent.
  source: z.enum(['PURCHASED', 'GRANTED']),
  status: memberPlanStatusEnum,
});
export type MembershipHistoryItem = z.infer<typeof membershipHistoryItemSchema>;

export const myMembershipResponseSchema = z.object({
  plan: z
    .object({
      code: z.string(),
      name: z.string(),
      isAssisted: z.boolean(),
      phoneUnlockLimit: z.number().nullable(),
      // The plan's own feature list, with availability flags.
      features: z.array(planFeatureSchema),
      // Listing tier: 0 standard, 1 priority, 2 spotlight.
      searchTier: z.number(),
    })
    .nullable(),
  status: z.enum(['ACTIVE', 'FREE']),
  // True when the server requires a plan (REQUIRE_PAID_PLAN) and the member
  // has none: browsing members, search, interests and chat are refused.
  accessLocked: z.boolean(),
  // Current plan period.
  startedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  // End of the last already-paid renewal (equals expiresAt when none).
  paidThroughAt: z.string().nullable(),
  // Plans that start later (renewals), soonest first.
  queued: z.array(membershipHistoryItemSchema),
  // Every plan the member has had, newest first (up to 20).
  history: z.array(membershipHistoryItemSchema),
  // For a free member: the most recent plan that ended, and how.
  lastEnded: z
    .object({ planName: z.string(), endedAt: z.string(), kind: z.enum(['EXPIRED', 'CANCELLED']) })
    .nullable(),
  // Paid plans: phone unlocks used in the current plan period, and what's
  // left (null = unlimited). null for free members.
  phoneUnlocksUsed: z.number().nullable(),
  phoneUnlocksRemaining: z.number().nullable(),
  // Free members: interests sent this calendar month (India time), the
  // monthly limit and when it resets. null for paid members (no limit).
  interestsUsedThisMonth: z.number().nullable(),
  interestsLimit: z.number().nullable(),
  resetsAt: z.string().nullable(),
});
export type MyMembershipResponse = z.infer<typeof myMembershipResponseSchema>;

// GET /membership-plans. freeInterestsPerMonth is the monthly interest limit
// for members without a plan (FREE_INTERESTS_PER_MONTH), so copy never
// hardcodes it. requirePaidPlan mirrors REQUIRE_PAID_PLAN: when true, members
// without a plan can't browse, search, send interests or chat, and the
// Membership page says so (it's public, so it can't rely on /me/membership).
export const membershipPlansResponseSchema = z.object({
  items: z.array(membershipPlanResponseSchema),
  freeInterestsPerMonth: z.number(),
  requirePaidPlan: z.boolean(),
});
export type MembershipPlansResponse = z.infer<typeof membershipPlansResponseSchema>;
