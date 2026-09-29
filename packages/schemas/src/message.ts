import { z } from 'zod';

export const sendMessageRequestSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(2000, 'Message is too long'),
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const messageStatusEnum = z.enum(['SENT', 'DELIVERED', 'READ']);
export type MessageStatus = z.infer<typeof messageStatusEnum>;

export const messageResponseSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  senderId: z.string(),
  body: z.string(),
  status: messageStatusEnum,
  createdAt: z.string(),
});
export type MessageResponse = z.infer<typeof messageResponseSchema>;

export const messageListResponseSchema = z.object({
  items: z.array(messageResponseSchema),
  nextOffset: z.number().nullable(),
});
export type MessageListResponse = z.infer<typeof messageListResponseSchema>;

const conversationParticipantSummarySchema = z.object({
  userId: z.string(),
  profileId: z.string().nullable(),
  fullName: z.string(),
  primaryPhotoUrl: z.string().nullable(),
});
export type ConversationParticipantSummary = z.infer<typeof conversationParticipantSummarySchema>;

// GET /conversations/:id — the thread header. `available` is false when the
// other member is suspended, pending deletion or deleted (or has no profile);
// fullName is then a neutral fallback and there is no photo.
export const conversationDetailSchema = z.object({
  id: z.string(),
  otherParticipant: conversationParticipantSummarySchema.extend({ available: z.boolean() }),
});
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

// GET /messages/unread-count — messages sent TO the caller that they haven't
// opened yet, across all their conversations (blocked pairs excluded).
export const unreadMessagesCountResponseSchema = z.object({ unreadCount: z.number() });
export type UnreadMessagesCountResponse = z.infer<typeof unreadMessagesCountResponseSchema>;

export const conversationSummarySchema = z.object({
  id: z.string(),
  otherParticipant: conversationParticipantSummarySchema,
  lastMessage: z
    .object({ body: z.string(), senderId: z.string(), createdAt: z.string() })
    .nullable(),
  createdAt: z.string(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const conversationListResponseSchema = z.object({
  items: z.array(conversationSummarySchema),
});
export type ConversationListResponse = z.infer<typeof conversationListResponseSchema>;
