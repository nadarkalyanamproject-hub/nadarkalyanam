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
      region: configService.get('STORAGE_REGION', { infer: true }),
      forcePathStyle: configService.get('STORAGE_FORCE_PATH_STYLE', { infer: true }),
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
