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

export const photoResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  isPrimary: z.boolean(),
  sortOrder: z.number(),
});
export type PhotoResponse = z.infer<typeof photoResponseSchema>;
