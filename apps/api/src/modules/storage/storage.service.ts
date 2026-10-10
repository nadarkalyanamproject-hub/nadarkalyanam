import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fileTypeFromBuffer } from 'file-type';
import type { Env } from '../config/env.schema.js';
import { S3_CLIENT } from './storage.constants.js';

const UPLOAD_URL_TTL_SECONDS = 300;
// Long enough to comfortably cover a normal page view/session (nothing in
// this app caches a profile/photo API response beyond a single request —
// every page fetches fresh on load), short enough to limit exposure if a
// URL were ever shared or leaked.
const GET_URL_TTL_SECONDS = 3600;
const DEFAULT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function isExternalUrl(objectKey: string): boolean {
  return objectKey.startsWith('http://') || objectKey.startsWith('https://');
}

export interface ImageValidationOptions {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
}

export interface ValidatedImage {
  mime: string;
  sizeBytes: number;
}

async function bodyToBytes(body: unknown): Promise<Uint8Array> {
  if (!body) {
    return new Uint8Array(0);
  }
  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
    return await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray!();
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return body;
  }
  if (typeof (body as AsyncIterable<Uint8Array>)[Symbol.asyncIterator] === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  return new Uint8Array(0);
}

@Injectable()
export class StorageService {
  private readonly bucket: string;
  private readonly defaultMaxSizeBytes: number;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    configService: ConfigService<Env, true>,
  ) {
    this.bucket = configService.get('MINIO_BUCKET_NAME', { infer: true });
    this.defaultMaxSizeBytes = configService.get('MAX_PHOTO_SIZE_BYTES', { infer: true }) ?? DEFAULT_MAX_FILE_SIZE_BYTES;
  }

  async createUploadUrl(objectKey: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  }

  // External-URL "keys" (seed/mock data, see getObjectUrl) aren't objects in
  // this bucket, so there is nothing to delete for them.
  async deleteObject(objectKey: string): Promise<void> {
    if (isExternalUrl(objectKey)) {
      return;
    }
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }

  // The bucket is private (no anonymous-download policy), so every read
  // needs a short-lived pre-signed GET URL — same S3Client, same
  // presigner, same pattern as createUploadUrl above, just GetObjectCommand
  // instead of PutObjectCommand.
  //
  // The startsWith check is for seed/mock data: some profiles carry a full
  // external URL (e.g. a placeholder image) in place of a real object key,
  // which can't be (and doesn't need to be) signed — pass it through as-is.
  async getObjectUrl(objectKey: string): Promise<string> {
    if (isExternalUrl(objectKey)) {
      return objectKey;
    }
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: objectKey });
    return getSignedUrl(this.s3, command, { expiresIn: GET_URL_TTL_SECONDS });
  }

  // Validates uploaded image content type by magic bytes (JPEG, PNG, WebP only)
  // and enforces file size limit (NFR-4.5). Deletes the invalid object from
  // storage and throws BadRequestException if validation fails.
  async validateUploadedImage(
    objectKey: string,
    options?: ImageValidationOptions,
  ): Promise<ValidatedImage> {
    if (isExternalUrl(objectKey)) {
      return { mime: 'image/jpeg', sizeBytes: 0 };
    }

    const maxSizeBytes = options?.maxSizeBytes ?? this.defaultMaxSizeBytes;
    const allowedMimeTypes = options?.allowedMimeTypes ?? ALLOWED_IMAGE_MIME_TYPES;

    let response;
    try {
      response = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    } catch (err: unknown) {
      const errorName = (err as { name?: string })?.name;
      if (errorName === 'NoSuchKey' || errorName === 'NotFound') {
        throw new BadRequestException('Uploaded file not found in storage. Please upload the file before confirming.');
      }
      throw err;
    }

    const contentLength = response.ContentLength ?? 0;
    if (contentLength === 0) {
      await this.deleteObject(objectKey);
      throw new BadRequestException('Uploaded file is empty.');
    }

    if (contentLength > maxSizeBytes) {
      await this.deleteObject(objectKey);
      const limitMb = (maxSizeBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '');
      throw new BadRequestException(`Uploaded file exceeds maximum allowed size of ${limitMb}MB.`);
    }

    const bytes = await bodyToBytes(response.Body);
    if (bytes.length === 0) {
      await this.deleteObject(objectKey);
      throw new BadRequestException('Uploaded file is empty.');
    }

    if (bytes.length > maxSizeBytes) {
      await this.deleteObject(objectKey);
      const limitMb = (maxSizeBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '');
      throw new BadRequestException(`Uploaded file exceeds maximum allowed size of ${limitMb}MB.`);
    }

    const detected = await fileTypeFromBuffer(bytes);
    if (!detected || !allowedMimeTypes.includes(detected.mime)) {
      await this.deleteObject(objectKey);
      throw new BadRequestException('Invalid file content: only JPEG, PNG, and WebP images are allowed.');
    }

    return {
      mime: detected.mime,
      sizeBytes: contentLength || bytes.length,
    };
  }
}
