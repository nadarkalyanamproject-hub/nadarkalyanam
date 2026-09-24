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
  private readonly publicUrl: string | undefined;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    configService: ConfigService<Env, true>,
  ) {
    this.bucket = configService.get('MINIO_BUCKET_NAME', { infer: true });
    this.endpoint = configService.get('MINIO_ENDPOINT', { infer: true });
    this.publicUrl = configService.get('STORAGE_PUBLIC_URL', { infer: true });
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
  // minio-init step, or the provider's equivalent in production) makes this
  // URL resolvable without auth — no signing needed for reads.
  //
  // STORAGE_PUBLIC_URL overrides this when set (e.g. a provider's public
  // bucket domain or a CDN in front of it). Without it, this falls back to
  // path-style (`${endpoint}/${bucket}/${key}`), which only resolves
  // correctly when STORAGE_FORCE_PATH_STYLE is true — virtual-hosted-style
  // providers (e.g. AWS S3 with forcePathStyle: false) must set
  // STORAGE_PUBLIC_URL explicitly.
  getObjectUrl(objectKey: string): string {
    if (objectKey.startsWith('http://') || objectKey.startsWith('https://')) {
      return objectKey;
    }
    const base = this.publicUrl ?? `${this.endpoint}/${this.bucket}`;
    return `${base}/${objectKey}`;
  }
}
