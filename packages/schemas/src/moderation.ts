import { z } from 'zod';

// Who to block: a member's user id (chat header) or profile id (profile
// page) - exactly one of the two.
export const blockRequestSchema = z
  .object({
    targetUserId: z.string().min(1).optional(),
    targetProfileId: z.string().min(1).optional(),
  })
  .refine((body) => Boolean(body.targetUserId) !== Boolean(body.targetProfileId), {
    message: 'Provide either targetUserId or targetProfileId',
  });
export type BlockRequest = z.infer<typeof blockRequestSchema>;

// GET /blocks - members the caller has blocked, most recent first. Blocks
// made by the other side are never listed (and can't be undone here).
export const blockedMemberSchema = z.object({
  userId: z.string(),
  profileId: z.string().nullable(),
  fullName: z.string(),
  primaryPhotoUrl: z.string().nullable(),
  blockedAt: z.string(),
});
export type BlockedMember = z.infer<typeof blockedMemberSchema>;

export const blockedMembersResponseSchema = z.object({ items: z.array(blockedMemberSchema) });
export type BlockedMembersResponse = z.infer<typeof blockedMembersResponseSchema>;

export const reportRequestSchema = z.object({
  targetType: z.enum(['PROFILE', 'MESSAGE']),
  targetId: z.string().min(1, 'targetId is required'),
  reason: z.string().min(1, 'reason is required'),
});
export type ReportRequest = z.infer<typeof reportRequestSchema>;

export const reportStatusEnum = z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']);
export type ReportStatus = z.infer<typeof reportStatusEnum>;

export const reportResponseSchema = z.object({
  id: z.string(),
  reporterId: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  reason: z.string(),
  status: reportStatusEnum,
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
});
export type ReportResponse = z.infer<typeof reportResponseSchema>;

// IN_REVIEW marks a report as picked up; RESOLVED/DISMISSED close it. The
// optional note has no column on Report — it's kept in the audit log entry
// the transition writes (see AdminController.updateReport).
export const resolveReportRequestSchema = z.object({
  status: z.enum(['IN_REVIEW', 'RESOLVED', 'DISMISSED']),
  note: z.string().trim().max(1000).optional(),
});
export type ResolveReportRequest = z.infer<typeof resolveReportRequestSchema>;

// GET /admin/reports?status=… — omitted means the open queue (OPEN +
// IN_REVIEW), the queue's original behaviour.
export const adminReportsQuerySchema = z.object({
  offset: z.string().optional(),
  limit: z.string().optional(),
  status: reportStatusEnum.optional(),
});
export type AdminReportsQuery = z.infer<typeof adminReportsQuerySchema>;
