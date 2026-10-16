import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PhotoResponse } from '@nadar-kalyanam/schemas';
import { APPROVED_PHOTO_WHERE, photoStatus } from '../../common/photo-visibility.js';
import { refreshCompletionScore } from '../../common/profile-completion.js';
import type { Env } from '../config/env.schema.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  private async getOwnedProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException('Profile not found for this user');
    }
    return profile;
  }

  async createUploadUrl(
    userId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; objectKey: string }> {
    const profile = await this.getOwnedProfile(userId);

    const extension = CONTENT_TYPE_EXTENSIONS[contentType];
    const objectKey = `profiles/${profile.id}/${randomUUID()}.${extension}`;
    const uploadUrl = await this.storage.createUploadUrl(objectKey, contentType);

    return { uploadUrl, objectKey };
  }

  async confirmPhoto(userId: string, objectKey: string): Promise<PhotoResponse> {
    const profile = await this.getOwnedProfile(userId);

    // The client picks the objectKey it was given by createUploadUrl, but we
    // don't trust it blindly — confirm it's actually scoped to this user's
    // own profile before creating a row for it.
    if (!objectKey.startsWith(`profiles/${profile.id}/`)) {
      throw new BadRequestException('objectKey does not belong to this profile');
    }

    // Validate uploaded file content type (JPEG, PNG, WebP only) and size limit (NFR-4.5).
    // Rejects invalid/malicious files, deletes them from storage, and throws BadRequestException.
    const maxPhotoSizeBytes = this.configService.get('MAX_PHOTO_SIZE_BYTES', { infer: true });
    await this.storage.validateUploadedImage(objectKey, { maxSizeBytes: maxPhotoSizeBytes });

    const existingCount = await this.prisma.profilePhoto.count({
      where: { profileId: profile.id },
    });

    // Moderation hold: in 'pending' mode the photo waits for an admin to
    // approve it (Admin > member > Photos) and other members don't see it
    // until then. 'auto_approve' is the dev stub that approves on upload so
    // local profiles have something to show. PHOTO_MODERATION picks the
    // mode; unset, production holds and everything else auto-approves.
    const photoAutoApproveDevStub = this.moderationMode() === 'auto_approve';

    const photo = await this.prisma.profilePhoto.create({
      data: {
        profileId: profile.id,
        objectKey,
        // The first photo a profile gets is automatically its primary, so a
        // profile with photos always has one unless the user later deletes it.
        isPrimary: existingCount === 0,
        sortOrder: existingCount,
        isModerated: photoAutoApproveDevStub,
        isApproved: photoAutoApproveDevStub,
      },
    });
    // Having a photo is one of the completion fields.
    await refreshCompletionScore(this.prisma, profile.id);

    return this.toPhotoResponse(photo);
  }

  async setPrimaryPhoto(userId: string, photoId: string): Promise<PhotoResponse> {
    const profile = await this.getOwnedProfile(userId);
    const photo = await this.getOwnedPhoto(profile.id, photoId);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.profilePhoto.updateMany({
        where: { profileId: profile.id, isPrimary: true },
        data: { isPrimary: false },
      });
      return tx.profilePhoto.update({
        where: { id: photo.id },
        data: { isPrimary: true },
      });
    });

    return this.toPhotoResponse(updated);
  }

  async deletePhoto(userId: string, photoId: string): Promise<{ id: string; objectKey: string }> {
    const profile = await this.getOwnedProfile(userId);
    const photo = await this.getOwnedPhoto(profile.id, photoId);

    // DB row first, storage object second: if the storage delete fails we're
    // left with an orphaned object (wasted space, harmless), which is safer
    // than the reverse order leaving a DB row that points at nothing.
    await this.prisma.profilePhoto.delete({ where: { id: photo.id } });
    await refreshCompletionScore(this.prisma, profile.id);
    await this.storage.deleteObject(photo.objectKey);
    return { id: photo.id, objectKey: photo.objectKey };
  }

  // Photos as OTHER members may see them: approved only. Pass
  // includeUnapproved for the owner's own profile and for admins, who see
  // pending and rejected photos too (with their status).
  async getPhotosForProfile(
    profileId: string,
    options: { includeUnapproved?: boolean } = {},
  ): Promise<PhotoResponse[]> {
    const photos = await this.prisma.profilePhoto.findMany({
      where: options.includeUnapproved ? { profileId } : { profileId, ...APPROVED_PHOTO_WHERE },
      orderBy: { sortOrder: 'asc' },
    });

    return Promise.all(photos.map((photo) => this.toPhotoResponse(photo)));
  }

  // Admin decision on one of a member's photos. Scoped like deletePhoto: a
  // photo that isn't on this member's profile 404s. Re-deciding is allowed
  // (e.g. approving a photo rejected by mistake).
  async moderatePhoto(
    userId: string,
    photoId: string,
    decision: { approve: true } | { approve: false; reason: string },
  ): Promise<PhotoResponse> {
    const profile = await this.getOwnedProfile(userId);
    const photo = await this.getOwnedPhoto(profile.id, photoId);
    const updated = await this.prisma.profilePhoto.update({
      where: { id: photo.id },
      data: {
        isModerated: true,
        isApproved: decision.approve,
        rejectionReason: decision.approve ? null : decision.reason,
      },
    });
    return this.toPhotoResponse(updated);
  }

  moderationMode(): 'pending' | 'auto_approve' {
    return (
      this.configService.get('PHOTO_MODERATION', { infer: true }) ??
      (this.configService.get('NODE_ENV', { infer: true }) === 'production' ? 'pending' : 'auto_approve')
    );
  }

  private async getOwnedPhoto(profileId: string, photoId: string) {
    const photo = await this.prisma.profilePhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.profileId !== profileId) {
      throw new NotFoundException('Photo not found for this profile');
    }
    return photo;
  }

  private async toPhotoResponse(photo: {
    id: string;
    objectKey: string;
    isPrimary: boolean;
    sortOrder: number;
    isModerated: boolean;
    isApproved: boolean;
    rejectionReason: string | null;
  }): Promise<PhotoResponse> {
    return {
      id: photo.id,
      url: await this.storage.getObjectUrl(photo.objectKey),
      isPrimary: photo.isPrimary,
      sortOrder: photo.sortOrder,
      status: photoStatus(photo),
      rejectionReason: photo.rejectionReason,
    };
  }
}
