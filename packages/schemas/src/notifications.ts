import { z } from 'zod';

export const notificationResponseSchema = z.object({
  id: z.string(),
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
  read: z.boolean(),
  createdAt: z.string(),
});
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;

export const listNotificationsResponseSchema = z.object({
  items: z.array(notificationResponseSchema),
  nextOffset: z.number().nullable(),
});
export type ListNotificationsResponse = z.infer<typeof listNotificationsResponseSchema>;
