import type { PhotoStatus } from '@nadar-kalyanam/schemas';
import type { Prisma } from '../generated/prisma/client.js';

// Photo moderation hold: a photo is shown to other members only once an
// admin (or, outside production, the dev auto-approve stub) has approved it.
// The owner and admins always see every photo with its status.
export const APPROVED_PHOTO_WHERE = { isModerated: true, isApproved: true } satisfies Prisma.ProfilePhotoWhereInput;

export function photoStatus(photo: { isModerated: boolean; isApproved: boolean }): PhotoStatus {
  if (!photo.isModerated) return 'PENDING';
  return photo.isApproved ? 'APPROVED' : 'REJECTED';
}

export function isVisibleToOtherMembers(photo: { isModerated: boolean; isApproved: boolean }): boolean {
  return photoStatus(photo) === 'APPROVED';
}
