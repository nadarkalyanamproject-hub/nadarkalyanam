import { z } from 'zod';

// The caller's relationship with another member, derived from the Interest
// rows between the two users in BOTH directions (senderId/targetId are user
// ids). An ACCEPTED interest makes the pair CONNECTED regardless of who sent
// it. Precedence when rows exist both ways:
// CONNECTED > INTEREST_RECEIVED > INTEREST_SENT > NONE. DECLINED/WITHDRAWN
// history never counts as a relationship here (a declined interest still
// blocks re-sending server-side — that rule lives in InterestsService).
export const relationshipStatusEnum = z.enum(['NONE', 'INTEREST_SENT', 'INTEREST_RECEIVED', 'CONNECTED']);
export type RelationshipStatus = z.infer<typeof relationshipStatusEnum>;

// Shared by every response that shows another member with an interest
// action. conversationId is only set for CONNECTED (the conversation the
// accept created), so the UI can link straight to it.
export const relationshipFieldsSchema = z.object({
  relationshipStatus: relationshipStatusEnum,
  conversationId: z.string().nullable(),
});
export type RelationshipFields = z.infer<typeof relationshipFieldsSchema>;
