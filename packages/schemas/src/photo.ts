import { z } from 'zod';

export const ALLOWED_PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const requestUploadUrlSchema = z.object({
  contentType: z.enum(ALLOWED_PHOTO_CONTENT_TYPES),
});
export type RequestUploadUrlRequest = z.infer<typeof requestUploadUrlSchema>;

export const requestUploadUrlResponseSchema = z.object({
  uploadUrl: z.string(),
  objectKey: z.string(),
});
export type RequestUploadUrlResponse = z.infer<typeof requestUploadUrlResponseSchema>;

export const confirmPhotoSchema = z.object({
  objectKey: z.string().min(1, 'objectKey is required'),
});
export type ConfirmPhotoRequest = z.infer<typeof confirmPhotoSchema>;

// Moderation state. Other members are only ever sent APPROVED photos; the
// owner (and admins) see every photo with its status.
export const photoStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type PhotoStatus = z.infer<typeof photoStatusEnum>;

export const photoResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  isPrimary: z.boolean(),
  sortOrder: z.number(),
  status: photoStatusEnum,
  // Set when an admin rejected the photo.
  rejectionReason: z.string().nullable(),
});
export type PhotoResponse = z.infer<typeof photoResponseSchema>;

// Admin rejection of a member photo (POST /admin/members/:userId/photos/:photoId/reject).
export const rejectPhotoRequestSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required').max(500),
});
export type RejectPhotoRequest = z.infer<typeof rejectPhotoRequestSchema>;
