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
  'PLAN_ACTIVATED',
  'PLAN_EXPIRED',
  'PLAN_CANCELLED',
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

// The Notifications page tabs. profile/interests map to types via
// NOTIFICATION_CATEGORY_TYPES; 'all' and 'unread' aren't type filters.
// Admin/account notices belong to no category — they show under All and
// Unread only. There is deliberately no 'messages' category: messages have
// their own inbox and badge, and an unrecognized category (including an
// old ?category=messages link) is rejected with 400 by query validation.
export const notificationCategoryEnum = z.enum(['all', 'unread', 'profile', 'interests']);
export type NotificationCategory = z.infer<typeof notificationCategoryEnum>;

export const NOTIFICATION_CATEGORY_TYPES: Record<'profile' | 'interests', NotificationType[]> = {
  profile: ['PROFILE_VIEWED'],
  interests: ['INTEREST_RECEIVED', 'INTEREST_ACCEPTED'],
};

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  category: notificationCategoryEnum.optional(),
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
