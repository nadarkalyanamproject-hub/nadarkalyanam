import { z } from 'zod';

export const initiateVerificationResponseSchema = z.object({
  id: z.string(),
  redirectUrl: z.string(),
});
export type InitiateVerificationResponse = z.infer<typeof initiateVerificationResponseSchema>;

export const verificationCallbackRequestSchema = z.object({
  reference: z.string().min(1, 'reference is required'),
});
export type VerificationCallbackRequest = z.infer<typeof verificationCallbackRequestSchema>;

export const verificationStatusEnum = z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED']);
export type VerificationStatus = z.infer<typeof verificationStatusEnum>;

export const verificationStatusResponseSchema = z.object({
  // The latest attempt (PENDING when there is none yet).
  status: verificationStatusEnum,
  decidedAt: z.string().nullable(),
  // The member has passed DigiLocker at least once.
  verified: z.boolean(),
  // The DigiLocker gate applies and they haven't passed it: everything but
  // verification and logout answers 403 IDENTITY_REQUIRED.
  required: z.boolean(),
  // From the ID; locks the profile's name and date of birth (YYYY-MM-DD).
  identity: z.object({ name: z.string(), dateOfBirth: z.string() }).nullable(),
});
export type VerificationStatusResponse = z.infer<typeof verificationStatusResponseSchema>;
