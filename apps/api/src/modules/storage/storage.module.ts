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
      // SDK default is 'WHEN_SUPPORTED', which appends x-amz-checksum-crc32 /
      // x-amz-sdk-checksum-algorithm to every eligible request — including
      // pre-signed PUT URLs, where they land in the query string. Several
      // S3-compatible providers (B2, some R2/MinIO configs) don't handle
      // this and fail the browser's CORS preflight, surfacing as a
      // misleading "No Access-Control-Allow-Origin header" error that looks
      // like a CORS misconfiguration but isn't. 'WHEN_REQUIRED' only adds a
      // checksum when a specific operation mandates one.
      requestChecksumCalculation: 'WHEN_REQUIRED',
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
