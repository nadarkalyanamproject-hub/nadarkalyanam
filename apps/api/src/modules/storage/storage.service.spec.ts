import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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

  describe('deleteObject', () => {
    it('sends a DeleteObjectCommand for a real object key', async () => {
      const send = vi.fn().mockResolvedValue({});
      const configService = { get: vi.fn(() => 'nadar-kalyanam-photos') };
      const service = new StorageService({ send } as never, configService as never);

      await service.deleteObject('profiles/profile-1/photo.jpg');

      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
      expect(send.mock.calls[0][0].input).toEqual({ Bucket: 'nadar-kalyanam-photos', Key: 'profiles/profile-1/photo.jpg' });
    });

    it('is a no-op for an external URL (seed/mock data), which is not an object in this bucket', async () => {
      const send = vi.fn();
      const configService = { get: vi.fn(() => 'nadar-kalyanam-photos') };
      const service = new StorageService({ send } as never, configService as never);

      await service.deleteObject('https://images.example/seed.jpg');

      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('validateUploadedImage', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
    ]);
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ header
    const textBuffer = Buffer.from('console.log("not an image");');

    function mockGetObjectResponse(bytes: Buffer, contentLength?: number) {
      return {
        ContentLength: contentLength ?? bytes.length,
        Body: {
          transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array(bytes)),
        },
      };
    }

    it('successfully validates a genuine JPEG image', async () => {
      const send = vi.fn().mockResolvedValue(mockGetObjectResponse(jpegBuffer));
      const configService = { get: vi.fn((key: string) => (key === 'MINIO_BUCKET_NAME' ? 'nadar-kalyanam-photos' : undefined)) };
      const service = new StorageService({ send } as never, configService as never);

      const result = await service.validateUploadedImage('profiles/p1/photo.jpg');

      expect(result.mime).toBe('image/jpeg');
      expect(result.sizeBytes).toBe(jpegBuffer.length);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('successfully validates a genuine PNG image', async () => {
      const send = vi.fn().mockResolvedValue(mockGetObjectResponse(pngBuffer));
      const configService = { get: vi.fn((key: string) => (key === 'MINIO_BUCKET_NAME' ? 'nadar-kalyanam-photos' : undefined)) };
      const service = new StorageService({ send } as never, configService as never);

      const result = await service.validateUploadedImage('profiles/p1/photo.png');

      expect(result.mime).toBe('image/png');
      expect(result.sizeBytes).toBe(pngBuffer.length);
    });

    it('successfully validates a genuine WebP image', async () => {
      const send = vi.fn().mockResolvedValue(mockGetObjectResponse(webpBuffer));
      const configService = { get: vi.fn((key: string) => (key === 'MINIO_BUCKET_NAME' ? 'nadar-kalyanam-photos' : undefined)) };
      const service = new StorageService({ send } as never, configService as never);

      const result = await service.validateUploadedImage('profiles/p1/photo.webp');

      expect(result.mime).toBe('image/webp');
      expect(result.sizeBytes).toBe(webpBuffer.length);
    });

    it('rejects an executable (.exe disguised as .jpg) and deletes the file from storage', async () => {
      const send = vi.fn()
        .mockResolvedValueOnce(mockGetObjectResponse(exeBuffer)) // GetObjectCommand
        .mockResolvedValueOnce({}); // DeleteObjectCommand
      const configService = { get: vi.fn((key: string) => (key === 'MINIO_BUCKET_NAME' ? 'nadar-kalyanam-photos' : undefined)) };
      const service = new StorageService({ send } as never, configService as never);

      await expect(service.validateUploadedImage('profiles/p1/malicious.jpg')).rejects.toThrow(
        'Invalid file content: only JPEG, PNG, and WebP images are allowed.',
      );

      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
      expect(send.mock.calls[1][0].input).toEqual({
        Bucket: 'nadar-kalyanam-photos',
        Key: 'profiles/p1/malicious.jpg',
      });
    });

    it('rejects a text/corrupt file disguised as .jpg and deletes it from storage', async () => {
      const send = vi.fn()
        .mockResolvedValueOnce(mockGetObjectResponse(textBuffer))
        .mockResolvedValueOnce({});
      const configService = { get: vi.fn((key: string) => (key === 'MINIO_BUCKET_NAME' ? 'nadar-kalyanam-photos' : undefined)) };
      const service = new StorageService({ send } as never, configService as never);

      await expect(service.validateUploadedImage('profiles/p1/fake.jpg')).rejects.toThrow(
        'Invalid file content: only JPEG, PNG, and WebP images are allowed.',
      );

      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
    });

    it('rejects an empty file and deletes it from storage', async () => {
      const send = vi.fn()
        .mockResolvedValueOnce({ ContentLength: 0, Body: { transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array(0)) } })
        .mockResolvedValueOnce({});
      const configService = { get: vi.fn((key: string) => (key === 'MINIO_BUCKET_NAME' ? 'nadar-kalyanam-photos' : undefined)) };
      const service = new StorageService({ send } as never, configService as never);

      await expect(service.validateUploadedImage('profiles/p1/empty.jpg')).rejects.toThrow(
        'Uploaded file is empty.',
      );

      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
    });

    it('rejects an oversized file exceeding the configured limit and deletes it from storage', async () => {
      const limitBytes = 1024; // 1KB for test
      const send = vi.fn()
        .mockResolvedValueOnce({ ContentLength: 2048 })
        .mockResolvedValueOnce({});
      const configService = { get: vi.fn((key: string) => (key === 'MINIO_BUCKET_NAME' ? 'nadar-kalyanam-photos' : undefined)) };
      const service = new StorageService({ send } as never, configService as never);

      await expect(
        service.validateUploadedImage('profiles/p1/large.jpg', { maxSizeBytes: limitBytes }),
      ).rejects.toThrow('Uploaded file exceeds maximum allowed size');

      expect(send).toHaveBeenCalledTimes(2);
      expect(send.mock.calls[1][0]).toBeInstanceOf(DeleteObjectCommand);
    });

    it('throws BadRequestException when object does not exist in storage', async () => {
      const notFoundError = new Error('The specified key does not exist.');
      notFoundError.name = 'NoSuchKey';
      const send = vi.fn().mockRejectedValueOnce(notFoundError);
      const configService = { get: vi.fn((key: string) => (key === 'MINIO_BUCKET_NAME' ? 'nadar-kalyanam-photos' : undefined)) };
      const service = new StorageService({ send } as never, configService as never);

      await expect(service.validateUploadedImage('profiles/p1/missing.jpg')).rejects.toThrow(
        'Uploaded file not found in storage. Please upload the file before confirming.',
      );
    });

    it('passes external URL through without S3 calls (seed/mock data)', async () => {
      const send = vi.fn();
      const configService = { get: vi.fn((key: string) => (key === 'MINIO_BUCKET_NAME' ? 'nadar-kalyanam-photos' : undefined)) };
      const service = new StorageService({ send } as never, configService as never);

      const result = await service.validateUploadedImage('https://images.example/seed.jpg');

      expect(result.mime).toBe('image/jpeg');
      expect(send).not.toHaveBeenCalled();
    });
  });
});
