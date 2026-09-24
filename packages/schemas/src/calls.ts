import { z } from 'zod';

export const initiateCallRequestSchema = z.object({
  targetUserId: z.string().min(1, 'targetUserId is required'),
});
export type InitiateCallRequest = z.infer<typeof initiateCallRequestSchema>;

export const callStatusEnum = z.enum(['RINGING', 'ACCEPTED', 'REJECTED', 'ENDED', 'MISSED']);
export type CallStatus = z.infer<typeof callStatusEnum>;

export const callSessionResponseSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  token: z.string(),
  status: callStatusEnum,
});
export type CallSessionResponse = z.infer<typeof callSessionResponseSchema>;
