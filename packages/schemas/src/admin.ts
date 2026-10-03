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

// Admin photo moderation — a reason is required for the audit trail, same
// as suspend/remove.
export const removeMemberPhotoRequestSchema = z.object({
  reason: z.string().trim().min(1, 'reason is required'),
});
export type RemoveMemberPhotoRequest = z.infer<typeof removeMemberPhotoRequestSchema>;

export const accountStatusEnum = z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_DELETION', 'DELETED']);
export type AccountStatus = z.infer<typeof accountStatusEnum>;

// Query-string filters for GET /admin/members. Every value arrives as a
// string, so `verified` is an enum of the two literal strings rather than a
// coerced boolean (z.coerce.boolean() would turn "false" into true).
export const adminMembersQuerySchema = z.object({
  offset: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  status: accountStatusEnum.optional(),
  verified: z.enum(['true', 'false']).optional(),
  sort: z.enum(['newest', 'oldest']).optional(),
});
export type AdminMembersQuery = z.infer<typeof adminMembersQuerySchema>;

const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'must be an ISO date or date-time' });

export const adminAuditLogsQuerySchema = z.object({
  offset: z.string().optional(),
  limit: z.string().optional(),
  action: z.string().min(1).optional(),
  adminId: z.string().min(1).optional(),
  targetType: z.string().min(1).optional(),
  targetId: z.string().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type AdminAuditLogsQuery = z.infer<typeof adminAuditLogsQuerySchema>;

// --- Admin user management ------------------------------------------------

// AdminUser.email is a required, unique column, so creating an admin needs
// one even though login itself is phone/OTP only.
export const createAdminRequestSchema = z.object({
  // Same E.164 rule as the OTP login request — this is the number the new
  // admin will log in with.
  phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format, e.g. +919876543210'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  roleId: z.string().min(1, 'roleId is required'),
});
export type CreateAdminRequest = z.infer<typeof createAdminRequestSchema>;

export const updateAdminRequestSchema = z
  .object({
    roleId: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => body.roleId !== undefined || body.isActive !== undefined, {
    message: 'Provide roleId and/or isActive',
  });
export type UpdateAdminRequest = z.infer<typeof updateAdminRequestSchema>;

// GET /admin/dashboard/activity?days=7|30|90 — per-day member activity in
// India time: that day's new signups and the total member count at its end.
export const MEMBER_ACTIVITY_WINDOWS = [7, 30, 90] as const;
export const memberActivityQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((days) => (MEMBER_ACTIVITY_WINDOWS as readonly number[]).includes(days), 'Use 7, 30 or 90'),
});
export type MemberActivityQuery = z.infer<typeof memberActivityQuerySchema>;

export const memberActivityPointSchema = z.object({
  date: z.string(), // YYYY-MM-DD, India time
  newSignups: z.number(),
  totalMembers: z.number(),
});
export type MemberActivityPoint = z.infer<typeof memberActivityPointSchema>;

export const memberActivityResponseSchema = z.object({
  days: z.number(),
  timezone: z.literal('Asia/Kolkata'),
  points: z.array(memberActivityPointSchema),
});
export type MemberActivityResponse = z.infer<typeof memberActivityResponseSchema>;

// GET /admin/dashboard/recent-activity?limit= — real platform events, newest
// first, merged from their own tables: registrations (users.createdAt),
// verifications (a SUCCEEDED verification request's decidedAt, set in the
// same transaction that marks the profile verified), reports filed
// (reports.createdAt) and admin actions (the audit log).
export const recentActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type RecentActivityQuery = z.infer<typeof recentActivityQuerySchema>;

const activityMember = z.object({ userId: z.string(), fullName: z.string().nullable(), phoneNumber: z.string() });

export const recentActivityItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('registration'), id: z.string(), at: z.string(), member: activityMember }),
  z.object({ type: z.literal('verification'), id: z.string(), at: z.string(), member: activityMember }),
  z.object({ type: z.literal('report'), id: z.string(), at: z.string(), targetType: z.string(), status: z.string() }),
  z.object({
    type: z.literal('admin_action'),
    id: z.string(),
    at: z.string(),
    action: z.string(),
    actorEmail: z.string().nullable(),
    targetType: z.string(),
    // The member an action was about (name/phone), the admin it changed, or
    // null for actions on a report.
    member: activityMember.nullable(),
    targetAdminEmail: z.string().nullable(),
  }),
]);
export type RecentActivityItem = z.infer<typeof recentActivityItemSchema>;

export const recentActivityResponseSchema = z.object({ items: z.array(recentActivityItemSchema) });
export type RecentActivityResponse = z.infer<typeof recentActivityResponseSchema>;
