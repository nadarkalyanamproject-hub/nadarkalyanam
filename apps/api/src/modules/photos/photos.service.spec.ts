import { BadRequestException, NotFoundException } from '@nestjs/common';
import { requestUploadUrlSchema } from '@nadar-kalyanam/schemas';
import { describe, expect, it, vi } from 'vitest';
import { PhotosService } from './photos.service.js';

const PROFILE_ID = 'profile-1';
const USER_ID = 'user-1';

interface TxMock {
  profilePhoto: {
    updateMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

function buildService(nodeEnv: string = 'test') {
  const tx: TxMock = {
    profilePhoto: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
  };
  const prisma = {
    profile: {
      findUnique: vi.fn().mockResolvedValue({ id: PROFILE_ID, userId: USER_ID }),
    },
    profilePhoto: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(async (callback: (tx: TxMock) => unknown) => callback(tx)),
  };
  const storage = {
    createUploadUrl: vi.fn().mockResolvedValue('https://minio.example/presigned-put-url'),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    getObjectUrl: vi.fn((objectKey: string) => `https://minio.example/bucket/${objectKey}`),
  };
  const configService = { get: vi.fn().mockReturnValue(nodeEnv) };

  const service = new PhotosService(prisma as never, storage as never, configService as never);
  return { service, prisma, storage, tx, configService };
}

describe('requestUploadUrlSchema', () => {
  it('accepts each allowed image content type', () => {
    for (const contentType of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(requestUploadUrlSchema.safeParse({ contentType }).success).toBe(true);
    }
  });

  it('rejects a non-image content type', () => {
    const result = requestUploadUrlSchema.safeParse({ contentType: 'text/plain' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing content type', () => {
    expect(requestUploadUrlSchema.safeParse({}).success).toBe(false);
  });
});

describe('PhotosService.createUploadUrl', () => {
  it('generates a pre-signed URL scoped under the profile id', async () => {
    const { service, storage } = buildService();

    const result = await service.createUploadUrl(USER_ID, 'image/jpeg');

    expect(result.objectKey).toMatch(new RegExp(`^profiles/${PROFILE_ID}/.+\\.jpg$`));
    expect(result.uploadUrl).toBe('https://minio.example/presigned-put-url');
    expect(storage.createUploadUrl).toHaveBeenCalledWith(result.objectKey, 'image/jpeg');
  });

  it('throws NotFoundException when the user has no profile', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce(null);

    await expect(service.createUploadUrl(USER_ID, 'image/jpeg')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PhotosService.confirmPhoto', () => {
  it('creates the first photo as primary and auto-approves it outside production', async () => {
    const { service, prisma } = buildService('development');
    const objectKey = `profiles/${PROFILE_ID}/photo-1.jpg`;
    prisma.profilePhoto.create.mockResolvedValueOnce({
      id: 'photo-1',
      objectKey,
      isPrimary: true,
      sortOrder: 0,
    });

    const result = await service.confirmPhoto(USER_ID, objectKey);

    expect(prisma.profilePhoto.create).toHaveBeenCalledWith({
      data: {
        profileId: PROFILE_ID,
        objectKey,
        isPrimary: true,
        sortOrder: 0,
        isModerated: true,
        isApproved: true,
      },
    });
    expect(result).toEqual({
      id: 'photo-1',
      url: `https://minio.example/bucket/${objectKey}`,
      isPrimary: true,
      sortOrder: 0,
    });
  });

  it('does not auto-approve in production', async () => {
    const { service, prisma } = buildService('production');
    const objectKey = `profiles/${PROFILE_ID}/photo-1.jpg`;
    prisma.profilePhoto.create.mockResolvedValueOnce({
      id: 'photo-1',
      objectKey,
      isPrimary: true,
      sortOrder: 0,
    });

    await service.confirmPhoto(USER_ID, objectKey);

    expect(prisma.profilePhoto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isModerated: false, isApproved: false }),
    });
  });

  it('marks a second photo as not primary, appended after the first', async () => {
    const { service, prisma } = buildService();
    prisma.profilePhoto.count.mockResolvedValueOnce(1);
    const objectKey = `profiles/${PROFILE_ID}/photo-2.jpg`;
    prisma.profilePhoto.create.mockResolvedValueOnce({
      id: 'photo-2',
      objectKey,
      isPrimary: false,
      sortOrder: 1,
    });

    await service.confirmPhoto(USER_ID, objectKey);

    expect(prisma.profilePhoto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isPrimary: false, sortOrder: 1 }),
    });
  });

  it('rejects an objectKey that does not belong to this profile', async () => {
    const { service } = buildService();

    await expect(
      service.confirmPhoto(USER_ID, 'profiles/some-other-profile/photo.jpg'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when the user has no profile', async () => {
    const { service, prisma } = buildService();
    prisma.profile.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.confirmPhoto(USER_ID, `profiles/${PROFILE_ID}/photo.jpg`),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PhotosService.setPrimaryPhoto', () => {
  it('unsets the previous primary and sets the new one inside a transaction', async () => {
    const { service, prisma, tx } = buildService();
    prisma.profilePhoto.findUnique.mockResolvedValueOnce({
      id: 'photo-2',
      profileId: PROFILE_ID,
      objectKey: `profiles/${PROFILE_ID}/photo-2.jpg`,
      isPrimary: false,
      sortOrder: 1,
    });
    tx.profilePhoto.update.mockResolvedValueOnce({
      id: 'photo-2',
      objectKey: `profiles/${PROFILE_ID}/photo-2.jpg`,
      isPrimary: true,
      sortOrder: 1,
    });

    const result = await service.setPrimaryPhoto(USER_ID, 'photo-2');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.profilePhoto.updateMany).toHaveBeenCalledWith({
      where: { profileId: PROFILE_ID, isPrimary: true },
      data: { isPrimary: false },
    });
    expect(tx.profilePhoto.update).toHaveBeenCalledWith({
      where: { id: 'photo-2' },
      data: { isPrimary: true },
    });
    expect(result.isPrimary).toBe(true);
  });

  it('throws NotFoundException for a photo belonging to a different profile', async () => {
    const { service, prisma } = buildService();
    prisma.profilePhoto.findUnique.mockResolvedValueOnce({
      id: 'photo-x',
      profileId: 'some-other-profile',
    });

    await expect(service.setPrimaryPhoto(USER_ID, 'photo-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws NotFoundException when the photo does not exist', async () => {
    const { service, prisma } = buildService();
    prisma.profilePhoto.findUnique.mockResolvedValueOnce(null);

    await expect(service.setPrimaryPhoto(USER_ID, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PhotosService.deletePhoto', () => {
  it('deletes the DB row and the storage object', async () => {
    const { service, prisma, storage } = buildService();
    const objectKey = `profiles/${PROFILE_ID}/photo-1.jpg`;
    prisma.profilePhoto.findUnique.mockResolvedValueOnce({
      id: 'photo-1',
      profileId: PROFILE_ID,
      objectKey,
    });

    await service.deletePhoto(USER_ID, 'photo-1');

    expect(prisma.profilePhoto.delete).toHaveBeenCalledWith({ where: { id: 'photo-1' } });
    expect(storage.deleteObject).toHaveBeenCalledWith(objectKey);
  });

  it('throws NotFoundException for a photo belonging to a different profile', async () => {
    const { service, prisma, storage } = buildService();
    prisma.profilePhoto.findUnique.mockResolvedValueOnce({
      id: 'photo-x',
      profileId: 'some-other-profile',
      objectKey: 'profiles/some-other-profile/photo-x.jpg',
    });

    await expect(service.deletePhoto(USER_ID, 'photo-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.profilePhoto.delete).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });
});

describe('PhotosService.getPhotosForProfile', () => {
  it('maps stored photos to display URLs ordered by sortOrder', async () => {
    const { service, prisma } = buildService();
    prisma.profilePhoto.findMany.mockResolvedValueOnce([
      { id: 'photo-1', objectKey: `profiles/${PROFILE_ID}/a.jpg`, isPrimary: true, sortOrder: 0 },
      { id: 'photo-2', objectKey: `profiles/${PROFILE_ID}/b.jpg`, isPrimary: false, sortOrder: 1 },
    ]);

    const result = await service.getPhotosForProfile(PROFILE_ID);

    expect(prisma.profilePhoto.findMany).toHaveBeenCalledWith({
      where: { profileId: PROFILE_ID },
      orderBy: { sortOrder: 'asc' },
    });
    expect(result).toEqual([
      { id: 'photo-1', url: `https://minio.example/bucket/profiles/${PROFILE_ID}/a.jpg`, isPrimary: true, sortOrder: 0 },
      { id: 'photo-2', url: `https://minio.example/bucket/profiles/${PROFILE_ID}/b.jpg`, isPrimary: false, sortOrder: 1 },
    ]);
  });
});
