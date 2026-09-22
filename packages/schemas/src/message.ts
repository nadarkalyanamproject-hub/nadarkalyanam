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
