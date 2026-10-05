import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // Comma-separated list of origins allowed to make cross-origin requests
  // (web app, admin app, ...) — CORS rejects everything else. Parsed by
  // common/cors-origins.ts, shared by main.ts's REST CORS and
  // realtime.gateway.ts's WebSocket CORS. Defaults to the local Next.js dev
  // servers (web on 3002, admin on 3001) so this doesn't break local
  // development when unset.
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3005,http://localhost:3002,http://localhost:3001'),
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
  // How many reverse proxies sit in front of the API, so Express reads the
  // real client IP from X-Forwarded-For (used by the per-IP OTP limit).
  // Unset: 1 in production (Render's proxy), 0 elsewhere — trusting the
  // header with no proxy in front would let a client spoof its IP.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).optional(),
  // Photo moderation hold. 'pending': new photos wait for an admin to
  // approve them before other members can see them. 'auto_approve': the
  // dev stub — photos are approved on upload. Unset: 'pending' in
  // production, 'auto_approve' elsewhere.
  PHOTO_MODERATION: z.enum(['pending', 'auto_approve']).optional(),
  // FR-1.5's anonymization step for members whose 14-day removal grace
  // period has elapsed (see modules/admin/anonymization). Destructive and
  // irreversible, so OFF by default: when false no queue, scheduler or
  // worker is created at all. Same safe-boolean pattern as above.
  ENABLE_ANONYMIZATION_JOB: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Only meaningful when the job is enabled: logs which members WOULD be
  // anonymized and writes nothing. Run a dry-run pass first on any new
  // environment.
  ANONYMIZATION_DRY_RUN: z
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
