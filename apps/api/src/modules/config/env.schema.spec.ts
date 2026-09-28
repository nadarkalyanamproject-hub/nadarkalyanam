import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

const validMinioEnv = {
  MINIO_ENDPOINT: 'http://localhost:9002',
  MINIO_ACCESS_KEY: 'nadar_minio',
  MINIO_SECRET_KEY: 'nadar_minio_password',
  MINIO_BUCKET_NAME: 'nadar-kalyanam-photos',
  PAYMENT_WEBHOOK_SECRET: 'test-webhook-secret',
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

  it('throws when PAYMENT_WEBHOOK_SECRET is missing, with no insecure default', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5439/db',
        REDIS_URL: 'redis://localhost:6380',
        JWT_ACCESS_TOKEN_SECRET: 'test-secret',
        MINIO_ENDPOINT: 'http://localhost:9002',
        MINIO_ACCESS_KEY: 'nadar_minio',
        MINIO_SECRET_KEY: 'nadar_minio_password',
        MINIO_BUCKET_NAME: 'nadar-kalyanam-photos',
      }),
    ).toThrow(/PAYMENT_WEBHOOK_SECRET/);
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

  it('keeps the anonymization job and its dry-run mode OFF by default', () => {
    const env = validateEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost:5439/db',
      REDIS_URL: 'redis://localhost:6380',
      JWT_ACCESS_TOKEN_SECRET: 'test-secret',
      ...validMinioEnv,
    });

    expect(env.ENABLE_ANONYMIZATION_JOB).toBe(false);
    expect(env.ANONYMIZATION_DRY_RUN).toBe(false);
  });

  it('parses the literal string "false" as false (not truthy) and rejects anything but true/false', () => {
    const base = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5439/db',
      REDIS_URL: 'redis://localhost:6380',
      JWT_ACCESS_TOKEN_SECRET: 'test-secret',
      ...validMinioEnv,
    };

    expect(validateEnv({ ...base, ENABLE_ANONYMIZATION_JOB: 'false' }).ENABLE_ANONYMIZATION_JOB).toBe(false);
    expect(validateEnv({ ...base, ENABLE_ANONYMIZATION_JOB: 'true' }).ENABLE_ANONYMIZATION_JOB).toBe(true);
    expect(() => validateEnv({ ...base, ENABLE_ANONYMIZATION_JOB: 'yes' })).toThrow(/ENABLE_ANONYMIZATION_JOB/);
  });
});
