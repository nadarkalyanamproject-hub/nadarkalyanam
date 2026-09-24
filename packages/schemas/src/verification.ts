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
  status: verificationStatusEnum,
  decidedAt: z.string().nullable(),
});
export type VerificationStatusResponse = z.infer<typeof verificationStatusResponseSchema>;
