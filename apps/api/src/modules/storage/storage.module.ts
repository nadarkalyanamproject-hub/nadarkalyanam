import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import type { Env } from '../config/env.schema.js';
import { S3_CLIENT } from './storage.constants.js';
import { StorageService } from './storage.service.js';

const s3ClientProvider: Provider = {
  provide: S3_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<Env, true>) =>
    new S3Client({
      endpoint: configService.get('MINIO_ENDPOINT', { infer: true }),
      region: 'us-east-1', // arbitrary — MinIO ignores region but the SDK requires one
      // MinIO is path-style (http://host/bucket/key), not the AWS-default
      // virtual-hosted-style (http://bucket.host/key).
      forcePathStyle: true,
      credentials: {
        accessKeyId: configService.get('MINIO_ACCESS_KEY', { infer: true }),
        secretAccessKey: configService.get('MINIO_SECRET_KEY', { infer: true }),
      },
    }),
};

@Global()
@Module({
  providers: [s3ClientProvider, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
