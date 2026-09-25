import { z } from 'zod';

export const suspendMemberRequestSchema = z.object({
  reason: z.string().min(1, 'reason is required'),
});
export type SuspendMemberRequest = z.infer<typeof suspendMemberRequestSchema>;

// Same shape as suspend — a reason is required for the same audit-trail
// reason, and it's the start of a 14-day grace period, not immediate
// deletion (see AdminService.removeMember).
export const removeMemberRequestSchema = z.object({
  reason: z.string().min(1, 'reason is required'),
});
export type RemoveMemberRequest = z.infer<typeof removeMemberRequestSchema>;
