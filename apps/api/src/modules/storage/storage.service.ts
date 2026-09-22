import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../config/env.schema.js';
import { S3_CLIENT } from './storage.constants.js';

const UPLOAD_URL_TTL_SECONDS = 300;

@Injectable()
export class StorageService {
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    configService: ConfigService<Env, true>,
  ) {
    this.bucket = configService.get('MINIO_BUCKET_NAME', { infer: true });
    this.endpoint = configService.get('MINIO_ENDPOINT', { infer: true });
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

  // The bucket's anonymous-download policy (set up in docker-compose's
  // minio-init step) makes this URL resolvable without auth — no signing
  // needed for reads.
  getObjectUrl(objectKey: string): string {
    return `${this.endpoint}/${this.bucket}/${objectKey}`;
  }
}
