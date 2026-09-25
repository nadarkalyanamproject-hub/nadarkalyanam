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
  // Generic HMAC secret used to verify the payment webhook signature (FR-7.3).
  // Provider-agnostic until a real payment gateway is contracted — see
  // PaymentGatewayAdapter. No default (matches JWT_ACCESS_TOKEN_SECRET):
  // production must not be able to boot with a guessable dev-string secret
  // for something that authenticates inbound webhook calls.
  PAYMENT_WEBHOOK_SECRET: z.string().min(1, 'PAYMENT_WEBHOOK_SECRET is required'),
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
  // TEMPORARY escape hatch, pending real SMS provider integration (see
  // auth.service.ts). Production normally has zero visibility into the OTP
  // it generates — no log, no response field. Setting this to true reveals
  // the OTP (response field + a server log line) regardless of NODE_ENV, so
  // registration/login can be completed manually. Defaults to false so it
  // can never ship on by accident — only ever set this temporarily while
  // manually testing, then unset it.
  ALLOW_OTP_DEBUG_VISIBILITY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
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
