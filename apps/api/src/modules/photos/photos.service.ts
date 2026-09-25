import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PhotoResponse } from '@nadar-kalyanam/schemas';
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

    const existingCount = await this.prisma.profilePhoto.count({
      where: { profileId: profile.id },
    });

    // DEV STUB: there is no real async photo-moderation pipeline in this
    // project (no job queue infrastructure like BullMQ exists yet, despite
    // ioredis already being used elsewhere for OTP). Outside production,
    // photos are auto-approved immediately on confirm so the profile page
    // has something to display. This bypasses real moderation and MUST be
    // replaced with an actual review workflow (a queue + admin review that
    // sets isModerated/isApproved) before any production use — mirrors the
    // devOtp dev-stub pattern in auth.service.ts.
    const photoAutoApproveDevStub =
      this.configService.get('NODE_ENV', { infer: true }) !== 'production';

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

  async deletePhoto(userId: string, photoId: string): Promise<void> {
    const profile = await this.getOwnedProfile(userId);
    const photo = await this.getOwnedPhoto(profile.id, photoId);

    // DB row first, storage object second: if the storage delete fails we're
    // left with an orphaned object (wasted space, harmless), which is safer
    // than the reverse order leaving a DB row that points at nothing.
    await this.prisma.profilePhoto.delete({ where: { id: photo.id } });
    await this.storage.deleteObject(photo.objectKey);
  }

  async getPhotosForProfile(profileId: string): Promise<PhotoResponse[]> {
    const photos = await this.prisma.profilePhoto.findMany({
      where: { profileId },
      orderBy: { sortOrder: 'asc' },
    });

    return Promise.all(photos.map((photo) => this.toPhotoResponse(photo)));
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
  }): Promise<PhotoResponse> {
    return {
      id: photo.id,
      url: await this.storage.getObjectUrl(photo.objectKey),
      isPrimary: photo.isPrimary,
      sortOrder: photo.sortOrder,
    };
  }
}
