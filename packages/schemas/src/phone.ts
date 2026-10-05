import { z } from 'zod';

// Who may unlock a member's phone number. NEVER: nobody. CONNECTED: a member
// they're connected with (accepted interest) who has an active paid plan.
export const phoneVisibilityEnum = z.enum(['CONNECTED', 'NEVER']);
export type PhoneVisibility = z.infer<typeof phoneVisibilityEnum>;

// The one place the default lives: nobody has consented until they turn it
// on. (The database column default mirrors it.)
export const DEFAULT_PHONE_VISIBILITY: PhoneVisibility = 'NEVER';

// PATCH /profiles/me/phone-visibility
export const updatePhoneVisibilitySchema = z.object({ phoneVisibility: phoneVisibilityEnum }).strict();
export type UpdatePhoneVisibilityRequest = z.infer<typeof updatePhoneVisibilitySchema>;

// What the viewer can do about another member's phone number, in the order
// the API checks it.
export const phoneUnlockStateEnum = z.enum([
  'NOT_CONNECTED', // no accepted interest between the two
  'HIDDEN_BY_MEMBER', // the member hasn't allowed phone unlocks
  'UNLOCKED', // already unlocked; showing it again is free
  'NO_PLAN', // the viewer has no active paid plan
  'QUOTA_EXHAUSTED', // the plan's unlocks are used up
  'AVAILABLE', // can unlock now (uses 1 unlock)
]);
export type PhoneUnlockState = z.infer<typeof phoneUnlockStateEnum>;

// GET /profiles/:id/phone-status. Never contains a phone number.
// limit: null = unlimited (or no plan). remaining: null when unlimited or no plan.
export const phoneStatusResponseSchema = z.object({
  state: phoneUnlockStateEnum,
  limit: z.number().nullable(),
  remaining: z.number().nullable(),
});
export type PhoneStatusResponse = z.infer<typeof phoneStatusResponseSchema>;

// POST /profiles/:id/phone-unlock — the ONLY response that carries a phone
// number (E.164).
export const phoneUnlockResponseSchema = phoneStatusResponseSchema.extend({
  state: z.literal('UNLOCKED'),
  phoneNumber: z.string(),
});
export type PhoneUnlockResponse = z.infer<typeof phoneUnlockResponseSchema>;
