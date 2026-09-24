import { z } from 'zod';

export const suspendMemberRequestSchema = z.object({
  reason: z.string().min(1, 'reason is required'),
});
export type SuspendMemberRequest = z.infer<typeof suspendMemberRequestSchema>;
