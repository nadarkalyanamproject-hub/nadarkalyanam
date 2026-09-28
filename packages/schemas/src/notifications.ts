import { z } from 'zod';

// In-app notification types. Anything else in the table (e.g. legacy
// 'message.new' rows written before these types existed) is still returned,
// with a generic message and no navigation target.
export const notificationTypeEnum = z.enum([
  'INTEREST_RECEIVED',
  'INTEREST_ACCEPTED',
  'PROFILE_VIEWED',
  'NEW_MESSAGE',
  'ADMIN_PHOTO_REMOVED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_REINSTATED',
  'REMOVAL_SCHEDULED',
  'REMOVAL_CANCELLED',
]);
export type NotificationType = z.infer<typeof notificationTypeEnum>;

export const notificationTargetTypeEnum = z.enum(['Interest', 'Conversation', 'Profile', 'Account']);
export type NotificationTargetType = z.infer<typeof notificationTargetTypeEnum>;

// Who caused it — name and signed photo URL only. System/admin notices use
// { name: 'Nadar Kalyanam', photoUrl: null }. Never email/phone/dateOfBirth.
export const notificationActorSchema = z.object({
  name: z.string(),
  photoUrl: z.string().nullable(),
});

export const notificationResponseSchema = z.object({
  id: z.string(),
  // A NotificationType for everything this app writes; kept as a string so
  // an older/unknown type never breaks the whole list.
  type: z.string(),
  // Generated at read time from type + the actor's current name.
  message: z.string(),
  actor: notificationActorSchema,
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  // False when the thing it points at can no longer be opened (e.g. the
  // viewer's profile is now hidden) — the UI shows a friendly note instead
  // of navigating to a broken page.
  targetAvailable: z.boolean(),
  isRead: z.boolean(),
  createdAt: z.string(),
});
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  offset: z.string().optional(),
  limit: z.string().optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

export const listNotificationsResponseSchema = z.object({
  items: z.array(notificationResponseSchema),
  total: z.number(),
  unreadCount: z.number(),
  nextOffset: z.number().nullable(),
});
export type ListNotificationsResponse = z.infer<typeof listNotificationsResponseSchema>;

export const unreadCountResponseSchema = z.object({ unreadCount: z.number() });
export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;
