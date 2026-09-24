import { z } from 'zod';

export const membershipPlanResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceInPaise: z.number(),
  durationDays: z.number(),
  entitlements: z.record(z.string(), z.unknown()),
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

export const paymentWebhookEventSchema = z.object({
  providerEventId: z.string().min(1),
  orderId: z.string().min(1),
  status: z.enum(['PAID', 'FAILED']),
});
export type PaymentWebhookEventInput = z.infer<typeof paymentWebhookEventSchema>;

export const paymentHistoryItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  status: orderStatusEnum,
  createdAt: z.string(),
});
export type PaymentHistoryItem = z.infer<typeof paymentHistoryItemSchema>;
