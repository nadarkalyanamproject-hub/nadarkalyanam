import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // Origin the browser-facing web app is served from; CORS rejects everything
  // else. Defaults to the local Next.js dev server so this doesn't break
  // local development when unset.
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3002'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  JWT_ACCESS_TOKEN_SECRET: z.string().min(1, 'JWT_ACCESS_TOKEN_SECRET is required'),
  MINIO_ENDPOINT: z.string().min(1, 'MINIO_ENDPOINT is required'),
  MINIO_ACCESS_KEY: z.string().min(1, 'MINIO_ACCESS_KEY is required'),
  MINIO_SECRET_KEY: z.string().min(1, 'MINIO_SECRET_KEY is required'),
  MINIO_BUCKET_NAME: z.string().min(1, 'MINIO_BUCKET_NAME is required'),
  // MinIO (and some S3-compatible providers) require path-style requests
  // (http://host/bucket/key). Real AWS S3 expects virtual-hosted-style
  // (https://bucket.host/key) — set this to false when pointing at AWS S3
  // proper. Defaults to true to preserve the existing MinIO behavior.
  //
  // NOT z.coerce.boolean(): that coerces via `Boolean(str)`, so the string
  // "false" (as env vars always are) would coerce to `true`.
  STORAGE_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  // Arbitrary for MinIO and most S3-compatible providers, but real AWS S3
  // requires this to match the bucket's actual region or request signing
  // fails.
  STORAGE_REGION: z.string().min(1).default('us-east-1'),
  // Optional override for the public URL objects are read from (e.g. a
  // provider's public bucket domain or a CDN in front of it). Falls back to
  // `${MINIO_ENDPOINT}/${MINIO_BUCKET_NAME}` (path-style) when unset, which
  // only resolves correctly when STORAGE_FORCE_PATH_STYLE is true.
  STORAGE_PUBLIC_URL: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
