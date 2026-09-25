import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../config/env.schema.js';
import { S3_CLIENT } from './storage.constants.js';

const UPLOAD_URL_TTL_SECONDS = 300;
// Long enough to comfortably cover a normal page view/session (nothing in
// this app caches a profile/photo API response beyond a single request —
// every page fetches fresh on load), short enough to limit exposure if a
// URL were ever shared or leaked.
const GET_URL_TTL_SECONDS = 3600;

@Injectable()
export class StorageService {
  private readonly bucket: string;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    configService: ConfigService<Env, true>,
  ) {
    this.bucket = configService.get('MINIO_BUCKET_NAME', { infer: true });
  }

  async createUploadUrl(objectKey: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  }

  async deleteObject(objectKey: string): Promise<void> {
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
    if (objectKey.startsWith('http://') || objectKey.startsWith('https://')) {
      return objectKey;
    }
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: objectKey });
    return getSignedUrl(this.s3, command, { expiresIn: GET_URL_TTL_SECONDS });
  }
}
