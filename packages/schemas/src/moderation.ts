import { z } from 'zod';

export const blockRequestSchema = z.object({
  targetUserId: z.string().min(1, 'targetUserId is required'),
});
export type BlockRequest = z.infer<typeof blockRequestSchema>;

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

export const resolveReportRequestSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
});
export type ResolveReportRequest = z.infer<typeof resolveReportRequestSchema>;
