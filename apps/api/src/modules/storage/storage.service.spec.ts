import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service.js';

const { getSignedUrlMock } = vi.hoisted(() => ({
  getSignedUrlMock: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}));

function buildService() {
  const s3 = {};
  const configService = {
    get: vi.fn((key: string) => (key === 'MINIO_BUCKET_NAME' ? 'nadar-kalyanam-photos' : undefined)),
  };
  return new StorageService(s3 as never, configService as never);
}

describe('StorageService', () => {
  beforeEach(() => {
    getSignedUrlMock.mockReset();
    getSignedUrlMock.mockResolvedValue('https://signed.example/url');
  });

  describe('getObjectUrl', () => {
    it('returns a pre-signed GetObjectCommand URL, expiring in 1 hour, for a real object key', async () => {
      const service = buildService();

      const url = await service.getObjectUrl('profiles/profile-1/photo.jpg');

      expect(url).toBe('https://signed.example/url');
      expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
      const [, command, options] = getSignedUrlMock.mock.calls[0];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toEqual({ Bucket: 'nadar-kalyanam-photos', Key: 'profiles/profile-1/photo.jpg' });
      expect(options).toEqual({ expiresIn: 3600 });
    });

    it('passes a full external URL through unchanged, without signing (seed/mock data)', async () => {
      const service = buildService();

      const url = await service.getObjectUrl('https://cdn.example/mock-photo.jpg');

      expect(url).toBe('https://cdn.example/mock-photo.jpg');
      expect(getSignedUrlMock).not.toHaveBeenCalled();
    });
  });

  describe('createUploadUrl', () => {
    it('returns a pre-signed PutObjectCommand URL, expiring in 5 minutes', async () => {
      const service = buildService();

      const url = await service.createUploadUrl('profiles/profile-1/photo.jpg', 'image/jpeg');

      expect(url).toBe('https://signed.example/url');
      const [, command, options] = getSignedUrlMock.mock.calls[0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'nadar-kalyanam-photos',
        Key: 'profiles/profile-1/photo.jpg',
        ContentType: 'image/jpeg',
      });
      expect(options).toEqual({ expiresIn: 300 });
    });
  });
});
