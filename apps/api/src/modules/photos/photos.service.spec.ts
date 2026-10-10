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

function buildService(nodeEnv: string = 'test', photoModeration?: 'pending' | 'auto_approve') {
  const tx: TxMock = {
    profilePhoto: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
  };
  const prisma = {
    profile: {
      findUnique: vi.fn().mockResolvedValue({ id: PROFILE_ID, userId: USER_ID }),
      update: vi.fn(),
    },
    profilePhoto: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: TxMock) => unknown) => callback(tx)),
  };
  const storage = {
    createUploadUrl: vi.fn().mockResolvedValue('https://minio.example/presigned-put-url'),
    deleteObject: vi.fn().mockResolvedValue(undefined),
    getObjectUrl: vi.fn((objectKey: string) => Promise.resolve(`https://minio.example/bucket/${objectKey}`)),
    validateUploadedImage: vi.fn().mockResolvedValue({ mime: 'image/jpeg', sizeBytes: 1024 }),
  };
  const env: Record<string, unknown> = { NODE_ENV: nodeEnv, PHOTO_MODERATION: photoModeration };
  const configService = { get: vi.fn((key: string) => env[key]) };

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
    prisma.profilePhoto.create.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'photo-1', rejectionReason: null, ...data }),
    );

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
      status: 'APPROVED',
      rejectionReason: null,
    });
  });

  it('holds a new photo for review (PENDING) when PHOTO_MODERATION=pending, even outside production', async () => {
    const { service, prisma } = buildService('development', 'pending');
    const objectKey = `profiles/${PROFILE_ID}/photo-1.jpg`;
    prisma.profilePhoto.create.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'photo-1', rejectionReason: null, ...data }),
    );

    const result = await service.confirmPhoto(USER_ID, objectKey);

    expect(prisma.profilePhoto.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ isModerated: false, isApproved: false }),
    });
    expect(result.status).toBe('PENDING');
  });

  it('PHOTO_MODERATION=auto_approve keeps the dev stub even in production', () => {
    const { service } = buildService('production', 'auto_approve');
    expect(service.moderationMode()).toBe('auto_approve');
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

  it('validates upload content type and size via storage before creating photo record', async () => {
    const { service, prisma, storage } = buildService();
    const objectKey = `profiles/${PROFILE_ID}/valid.jpg`;
    prisma.profilePhoto.create.mockResolvedValueOnce({
      id: 'photo-1',
      objectKey,
      isPrimary: true,
      sortOrder: 0,
    });

    await service.confirmPhoto(USER_ID, objectKey);

    expect(storage.validateUploadedImage).toHaveBeenCalledWith(objectKey, { maxSizeBytes: undefined });
    expect(prisma.profilePhoto.create).toHaveBeenCalled();
  });

  it('rejects photo confirmation if storage validation fails (e.g. fake .jpg or .exe)', async () => {
    const { service, prisma, storage } = buildService();
    const objectKey = `profiles/${PROFILE_ID}/fake.jpg`;
    storage.validateUploadedImage.mockRejectedValueOnce(
      new BadRequestException('Invalid file content: only JPEG, PNG, and WebP images are allowed.'),
    );

    await expect(service.confirmPhoto(USER_ID, objectKey)).rejects.toThrow(
      'Invalid file content: only JPEG, PNG, and WebP images are allowed.',
    );
    expect(prisma.profilePhoto.create).not.toHaveBeenCalled();
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

  it('recomputes the completion score when a photo is added or removed', async () => {
    const { service, prisma } = buildService();
    const filled = {
      id: PROFILE_ID,
      userId: USER_ID,
      fullName: 'Meena Raj',
      gender: 'FEMALE',
      dateOfBirth: new Date('1996-01-01'),
      completionScore: 95,
      details: {
        motherTongue: 'Tamil', email: 'm@example.com', height: '160 cm', physicalStatus: 'NORMAL',
        maritalStatus: 'NEVER_MARRIED', religion: 'Hindu', casteCommunity: 'Nadar', dosham: 'NO',
        location: { city: 'Madurai', state: 'Tamil Nadu' },
        education: { educationLevel: 'B.E', educationDetail: 'CS', profession: 'Engineer', employedIn: 'Private', annualIncomeRange: '8-12 LPA' },
        additional: { familyType: 'Middle Class', about: 'About me.' },
      },
    };
    prisma.profile.findUnique.mockResolvedValue(filled);

    // Adding the first photo: 20/21 -> 21/21.
    prisma.profilePhoto.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    prisma.profilePhoto.create.mockResolvedValueOnce({ id: 'photo-1', profileId: PROFILE_ID, objectKey: `profiles/${PROFILE_ID}/a.jpg`, isPrimary: true, sortOrder: 0, isApproved: true, isModerated: true });
    await service.confirmPhoto(USER_ID, `profiles/${PROFILE_ID}/a.jpg`);
    expect(prisma.profile.update).toHaveBeenLastCalledWith({ where: { id: PROFILE_ID }, data: { completionScore: 100 } });

    // Deleting the only photo: back to 20/21.
    prisma.profile.findUnique.mockResolvedValue({ ...filled, completionScore: 100 });
    prisma.profilePhoto.findUnique.mockResolvedValueOnce({ id: 'photo-1', profileId: PROFILE_ID, objectKey: `profiles/${PROFILE_ID}/a.jpg` });
    prisma.profilePhoto.count.mockResolvedValueOnce(0);
    await service.deletePhoto(USER_ID, 'photo-1');
    expect(prisma.profile.update).toHaveBeenLastCalledWith({ where: { id: PROFILE_ID }, data: { completionScore: 95 } });
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
    const approved = { isModerated: true, isApproved: true, rejectionReason: null };
    prisma.profilePhoto.findMany.mockResolvedValueOnce([
      { id: 'photo-1', objectKey: `profiles/${PROFILE_ID}/a.jpg`, isPrimary: true, sortOrder: 0, ...approved },
      { id: 'photo-2', objectKey: `profiles/${PROFILE_ID}/b.jpg`, isPrimary: false, sortOrder: 1, ...approved },
    ]);

    const result = await service.getPhotosForProfile(PROFILE_ID);

    expect(result).toEqual([
      { id: 'photo-1', url: `https://minio.example/bucket/profiles/${PROFILE_ID}/a.jpg`, isPrimary: true, sortOrder: 0, status: 'APPROVED', rejectionReason: null },
      { id: 'photo-2', url: `https://minio.example/bucket/profiles/${PROFILE_ID}/b.jpg`, isPrimary: false, sortOrder: 1, status: 'APPROVED', rejectionReason: null },
    ]);
  });

  it('by default (what other members get) only queries approved photos', async () => {
    const { service, prisma } = buildService();

    await service.getPhotosForProfile(PROFILE_ID);

    expect(prisma.profilePhoto.findMany).toHaveBeenCalledWith({
      where: { profileId: PROFILE_ID, isModerated: true, isApproved: true },
      orderBy: { sortOrder: 'asc' },
    });
  });

  it('with includeUnapproved (owner/admin) returns pending and rejected photos too, labelled', async () => {
    const { service, prisma } = buildService();
    prisma.profilePhoto.findMany.mockResolvedValueOnce([
      { id: 'p1', objectKey: 'k1', isPrimary: true, sortOrder: 0, isModerated: false, isApproved: false, rejectionReason: null },
      { id: 'p2', objectKey: 'k2', isPrimary: false, sortOrder: 1, isModerated: true, isApproved: false, rejectionReason: 'Blurry' },
    ]);

    const result = await service.getPhotosForProfile(PROFILE_ID, { includeUnapproved: true });

    expect(prisma.profilePhoto.findMany).toHaveBeenCalledWith({ where: { profileId: PROFILE_ID }, orderBy: { sortOrder: 'asc' } });
    expect(result.map((photo) => [photo.status, photo.rejectionReason])).toEqual([
      ['PENDING', null],
      ['REJECTED', 'Blurry'],
    ]);
  });
});

describe('PhotosService.moderatePhoto', () => {
  it('approve marks the photo moderated and approved, clearing any old rejection reason', async () => {
    const { service, prisma } = buildService();
    prisma.profilePhoto.findUnique.mockResolvedValueOnce({ id: 'photo-1', profileId: PROFILE_ID });
    prisma.profilePhoto.update.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'photo-1', objectKey: 'k', isPrimary: true, sortOrder: 0, ...data }),
    );

    const result = await service.moderatePhoto(USER_ID, 'photo-1', { approve: true });

    expect(prisma.profilePhoto.update).toHaveBeenCalledWith({
      where: { id: 'photo-1' },
      data: { isModerated: true, isApproved: true, rejectionReason: null },
    });
    expect(result.status).toBe('APPROVED');
  });

  it('reject keeps the photo hidden and stores the reason for the owner', async () => {
    const { service, prisma } = buildService();
    prisma.profilePhoto.findUnique.mockResolvedValueOnce({ id: 'photo-1', profileId: PROFILE_ID });
    prisma.profilePhoto.update.mockImplementationOnce(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'photo-1', objectKey: 'k', isPrimary: true, sortOrder: 0, ...data }),
    );

    const result = await service.moderatePhoto(USER_ID, 'photo-1', { approve: false, reason: 'Group photo' });

    expect(result).toMatchObject({ status: 'REJECTED', rejectionReason: 'Group photo' });
  });

  it('404s for a photo on another member\'s profile', async () => {
    const { service, prisma } = buildService();
    prisma.profilePhoto.findUnique.mockResolvedValueOnce({ id: 'photo-9', profileId: 'other-profile' });

    await expect(service.moderatePhoto(USER_ID, 'photo-9', { approve: true })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.profilePhoto.update).not.toHaveBeenCalled();
  });
});
