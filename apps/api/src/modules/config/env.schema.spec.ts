import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

const validMinioEnv = {
  MINIO_ENDPOINT: 'http://localhost:9002',
  MINIO_ACCESS_KEY: 'nadar_minio',
  MINIO_SECRET_KEY: 'nadar_minio_password',
  MINIO_BUCKET_NAME: 'nadar-kalyanam-photos',
};

describe('validateEnv', () => {
  it('applies defaults for optional fields', () => {
    const env = validateEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost:5439/db',
      REDIS_URL: 'redis://localhost:6380',
      JWT_ACCESS_TOKEN_SECRET: 'test-secret',
      ...validMinioEnv,
    });

    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('throws when a required field is missing', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('throws when JWT_ACCESS_TOKEN_SECRET is missing', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5439/db',
        REDIS_URL: 'redis://localhost:6380',
        ...validMinioEnv,
      }),
    ).toThrow(/JWT_ACCESS_TOKEN_SECRET/);
  });

  it('throws when a MINIO_* field is missing', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5439/db',
        REDIS_URL: 'redis://localhost:6380',
        JWT_ACCESS_TOKEN_SECRET: 'test-secret',
        MINIO_ACCESS_KEY: 'nadar_minio',
        MINIO_SECRET_KEY: 'nadar_minio_password',
        MINIO_BUCKET_NAME: 'nadar-kalyanam-photos',
      }),
    ).toThrow(/MINIO_ENDPOINT/);
  });
});
