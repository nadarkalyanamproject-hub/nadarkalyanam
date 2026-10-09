# Backend Task List

Owner: backend developer (Node/NestJS). Scope: `apps/api` and `packages/schemas`.
UI (`apps/web`, `apps/admin`) is owned separately. Agree request/response shapes in
`packages/schemas` before building an endpoint that the UI will consume.

Reference: SRS v1.1 (`Desktop/Matrimony site/SRS revised.docx`). FR/NFR IDs below point to it.

## Ground rules

- One branch + one PR per task: `feat/<task-id>-<short-name>` (e.g. `feat/B03-sms-otp`).
- CI (`.github/workflows/ci.yml`) must pass: lint, typecheck, tests.
- `apps/api` uses ESM with `.js` extensions on relative imports.
- Every provider integration goes **behind the existing adapter interface**. Keep the stub
  adapter for local dev/tests and select the real one via env config.
- New env keys go in `src/modules/config/env.schema.ts` **and** in the README's env section.
  Remind the team to update their local `apps/api/.env`.
- Never commit secrets. Use provider **test/sandbox mode** keys until go-live.
- Money is always integer paise. Never trust client-supplied amounts, user IDs or roles.
- After a Prisma migration, run `prisma generate` and restart `pnpm dev`.

## Getting started (day 1)

1. Start Docker Desktop, then `docker compose up -d` (Postgres 5439, Redis 6380, MinIO).
2. `pnpm install`, `pnpm db:migrate:deploy`, `pnpm dev`.
3. Check `http://localhost:4000/api/v1/health` returns OK.
4. Log in on the web app (port 3005) with a `+91...` number; the OTP comes back as `devOtp` in dev.
5. Read: `src/app.module.ts`, `src/modules/auth`, `src/modules/payments`, `src/modules/notifications`, `prisma/schema.prisma`.

---

## Phase 1: Notifications and SMS (week 1)

### B01 · Harden the notification queue
**Why:** failed jobs are currently logged and lost, and completed jobs pile up in Redis (FR-10.5, FR-10.6).
**Files:** `src/modules/queue/*`, `src/modules/notifications/notifications.service.ts`, `notifications.processor.ts`

- Default job options: `attempts: 5`, `backoff: { type: 'exponential', delay: 2000 }`,
  `removeOnComplete: { count: 1000 }`, `removeOnFail: { age: 7 days }`.
- Deterministic `jobId` per event (e.g. `interest:<id>:accepted`, `message:<id>:new`) so duplicates are ignored.
- Split into per-channel queues: `notifications-push`, `notifications-sms`, `notifications-email`.
- Add `limiter` on the SMS and email queues (values in env, e.g. 10 jobs/sec).
- Worker `concurrency` configurable via env.

**Done when**
- [ ] A job whose adapter throws is retried 5 times with increasing delay, then stays in the failed set.
- [ ] Enqueuing the same event twice produces one job.
- [ ] A slow SMS adapter does not delay push jobs (test with a delayed fake adapter).
- [ ] Unit tests cover retry options, jobId generation and queue routing.

**Estimate:** 1 day

### B02 · Notification delivery tracking
**Why:** FR-10.6 requires traceable status, retry count and provider reference/error.

- New Prisma model `NotificationDelivery`: `id, notificationId?, userId, channel (PUSH|SMS|EMAIL),
  type, status (QUEUED|SENT|FAILED), attempts, providerMessageId?, lastError?, createdAt, updatedAt`.
- Worker updates the row on every attempt, success and final failure.
- Admin endpoint `GET /admin/notifications/deliveries` (filters: userId, channel, status; cursor pagination),
  permission-checked server-side like the other `/admin` routes.

**Done when**
- [ ] Every send attempt is visible with status and attempt count.
- [ ] Final failure stores the provider error message.
- [ ] Endpoint returns 403 for a role without permission.

**Estimate:** 1 day

### B03 · Real SMS OTP delivery
**Why:** OTP is currently only returned as `devOtp` or logged; nothing is sent (FR-1.1, FR-10.2).
**Files:** `src/modules/auth/auth.service.ts` (`requestOtp`), new `src/modules/auth/adapters/` or a shared `sms` adapter

- `SmsProviderAdapter` interface: `sendOtp(phoneE164, otp)` and `sendTemplate(phoneE164, templateId, vars)`.
- Implement **MSG91** (or 2Factor, confirm with the team), using a DLT-approved template ID from env.
- Keep a `LogSmsAdapter` for dev/test and select via env (`SMS_PROVIDER=log|msg91`).
- OTP SMS is sent **directly**, not through the notification queue (latency matters), with 1 quick retry.
- Keep the existing rate limit (5 requests / 10 min / phone) and `ALLOW_OTP_DEBUG_VISIBILITY` behaviour.

**Done when**
- [ ] With `SMS_PROVIDER=msg91` and test credentials, a real SMS arrives.
- [ ] Provider failure returns a clean error and does not leak the OTP.
- [ ] `devOtp` is never present when `NODE_ENV=production`.
- [ ] Unit tests with a mocked adapter.

**Estimate:** 1 day (+ DLT approval time, which is outside our control)

### B04 · Real push, email and SMS notification channels
**Why:** `log-channel.adapter.ts` is the only channel; no member actually gets notified (FR-10.1–10.3).
**Files:** `src/modules/notifications/adapters/*`

- **Push:** FCM via `firebase-admin`. Look up tokens from `Device.pushToken`. Remove tokens FCM reports as invalid.
- **Device registration:** `POST /devices` (`pushToken`, `platform: web|android|ios`) and `DELETE /devices/:id`, both for the authenticated user only.
- **Email:** Resend adapter with simple HTML templates: payment receipt, account deletion requested, account restored.
- **SMS:** reuse the B03 adapter for critical account events.
- Each channel is selected via env (`PUSH_PROVIDER=log|fcm`, `EMAIL_PROVIDER=log|resend`).

**Done when**
- [ ] A new interest triggers a real push on a registered test device.
- [ ] A payment success sends a real email (Resend test domain is fine).
- [ ] Invalid FCM tokens are cleaned up.
- [ ] Tests for token registration ownership (a user can't delete someone else's device).

**Estimate:** 2 days

### B05 · Notification preferences
**Why:** FR-10.4, members choose which notifications they receive, per channel and type.

- Model `NotificationPreference` (`userId, type, channel, enabled`), defaulting to all enabled.
- `GET /notifications/preferences` and `PUT /notifications/preferences`.
- The service skips disabled channel/type combinations **before** enqueuing.
- OTP and security-critical SMS cannot be disabled.

**Done when**
- [ ] Disabling "new message / push" stops those pushes but not in-app notifications.
- [ ] Tests for defaults, opt-out and the non-disableable types.

**Estimate:** 0.5 day

---

## Phase 2: Payments (week 2)

### B06 · Razorpay payment gateway adapter
**Why:** payments run on `stub-payment-gateway.adapter.ts` (FR-7.1–7.7).
**Files:** `src/modules/payments/adapters/*`, `payments.service.ts`, `payments.controller.ts`

- Implement `PaymentGatewayAdapter` for **Razorpay** (Cashfree only if the client picks it):
  - `createProviderOrder(orderId, amountInPaise)` creates a Razorpay order and returns checkout params.
  - `verifyWebhookSignature(rawBody, signature)` uses HMAC-SHA256 with the webhook secret and a constant-time compare.
- Make sure the webhook route gets the **raw body** (check `main.ts` body-parser config).
- Handle events: `payment.captured`, `payment.failed`, `refund.processed`.
- Idempotency on the provider event ID (FR-7.4). Activate membership **in the same transaction** as the payment state update (FR-7.5).
- Select via env: `PAYMENT_PROVIDER=stub|razorpay`.

**Done when**
- [ ] End-to-end in Razorpay test mode: choose plan → pay → webhook → membership active.
- [ ] Invalid or missing signature → 400/401, nothing written.
- [ ] Same webhook delivered 3 times → one payment, one subscription.
- [ ] Failed and refunded payments are reflected in order/payment status.
- [ ] Integration tests for all of the above.

**Estimate:** 2–3 days

### B07 · Payment receipts
**Why:** FR-7.6, payment history and downloadable receipts (not built).

- `GET /payments/:id/receipt` returns a PDF (e.g. `pdfkit`), owner-only.
- Receipt: receipt number, member name, plan, amount in ₹ (from paise), date, provider reference, GST line if configured.
- Email the receipt on successful payment (through B04's email channel).

**Done when**
- [ ] Owner can download their receipt; another user gets 403/404.
- [ ] Amount formatting is correct (`249900` paise → `₹2,499.00`).

**Estimate:** 1 day

### B08 · Admin: membership plans and refunds
- CRUD for `MembershipPlan` under `/admin/plans` (Finance/Super Admin only). Prices in paise; deactivate rather than delete plans that have been purchased.
- `POST /admin/payments/:id/refund` calls the gateway refund API. The status then updates via webhook.
- Every action writes an `AuditLog` entry (FR-11.4).

**Done when**
- [ ] Plan changes show up on `GET /membership-plans`.
- [ ] Refund works in Razorpay test mode and is audit-logged.
- [ ] Moderator role gets 403.

**Estimate:** 1 day

---

## Phase 3: Trust, calling, admin (weeks 3–4)

### B09 · Storage on Cloudflare R2 + upload validation
**Why:** production storage, plus NFR-4.5 (content-sniffed MIME type and size).

- Storage is already S3-compatible. Verify it works against R2 with env changes only (`MINIO_ENDPOINT`, keys, `STORAGE_REGION=auto`, path style).
- On `POST /profiles/me/photos/confirm`, read the object's first bytes and validate the real type (`file-type` package: jpeg/png/webp only) and a max size (env). Reject and delete on mismatch.
- Serve photos through CDN URLs and keep unmoderated photos private.

**Done when**
- [ ] Upload/confirm/primary/delete all work against an R2 bucket.
- [ ] A `.exe` renamed to `.jpg` is rejected.
- [ ] Unmoderated photos are never returned in other members' profile responses.

**Estimate:** 1 day

### B10 · Admin: photo moderation and verification queues
**Why:** FR-9.4 (photos held until moderated) and FR-8 (verification agents need a queue). There are no admin endpoints for these yet.

- `GET /admin/photos/pending` plus `POST /admin/photos/:id/approve|reject` (sets `isModerated`, notifies the member).
- `GET /admin/verifications` (filter by status) plus manual approve/reject for edge cases, respecting the FR-8.6 "latest valid decision governs" rule.
- Moderator and Verification Agent roles only; all actions audit-logged.

**Done when**
- [ ] Approved photo becomes visible to others; rejected photo is removed and the member is notified.
- [ ] A failed older verification can't overwrite a newer success (test it).

**Estimate:** 1.5 days

### B11 · KYC provider adapter
**Why:** `stub-identity-provider.adapter.ts` (FR-8.1–8.6).

- Implement `IdentityProviderAdapter` for the chosen provider (Digio / IDfy / Signzy; confirm with the team).
- `initiate` returns the provider redirect URL. `confirmStatus` makes a **server-to-server** check (FR-8.2).
- Store only status plus the opaque provider reference (FR-8.3). Add a retention/expiry field (FR-8.5).
- Env: `IDENTITY_PROVIDER=stub|<provider>`.

**Done when**
- [ ] Sandbox flow works end to end and sets the verified badge.
- [ ] Faking the client callback without provider confirmation does **not** verify the user.

**Estimate:** 2 days

### B12 · Calling provider adapter
**Why:** `stub-rtc-provider.adapter.ts` (FR-6.1–6.4).

- Implement `RtcProviderAdapter` with **LiveKit Cloud** (recommended), Agora or 100ms.
- `issueToken` returns a short-lived (≤ 10 min), room-scoped token.
- Record call metadata (start, end, duration, outcome). Never record media.
- Env: `RTC_PROVIDER=stub|livekit`.

**Done when**
- [ ] Two accepted matches get tokens for the same room; a non-match or blocked user gets 403.
- [ ] Tokens expire as configured.

**Estimate:** 1.5 days

### B13 · Scheduled jobs
Use BullMQ repeatable jobs (`upsertJobScheduler`), not a separate cron.

- Membership expiry reminders at 7 days and 1 day before expiry (push + email).
- Daily "new matches for you" digest (push). Respect notification preferences.
- Profile-incomplete nudge (weekly, max 3 times per user).
- Note: account anonymisation already exists behind `ENABLE_ANONYMIZATION_JOB`. Move it onto the same scheduler if it isn't there already.

**Done when**
- [ ] Jobs run on schedule locally (use short intervals via env for testing).
- [ ] No duplicate reminders when the API restarts or runs as 2 instances.

**Estimate:** 1.5 days

---

## Phase 4: Production (week 4)

### B14 · Production deployment
- `apps/api/Dockerfile` (multi-stage, pnpm, non-root user), plus Dockerfiles for `web` and `admin` (Next standalone output).
- `docker-compose.prod.yml`: api, worker (same image, worker entrypoint), web, admin, postgres, redis, and Caddy for SSL.
- Split the notification worker into its own process/container (see the note in `queue.module.ts`).
- Daily `pg_dump` to R2 with 14-day retention, plus a tested restore.
- Extend `ci.yml` to build images. Deploy on tag or on push to `main`.
- `/api/v1/health` is used by the container healthcheck.

**Done when**
- [ ] Fresh VPS → running stack with SSL from the README steps alone.
- [ ] Backup is created daily and a restore has been tested once.

**Estimate:** 2–3 days

### B15 · Security and test pass (ongoing, finish before go-live)
- Integration tests for the SRS acceptance examples: expired/reused OTP, blocked users can't message/call/see each other, the privacy precedence order, duplicate interests, webhook idempotency.
- Rate limits on search and messaging endpoints (NFR-4.6), not just OTP.
- Helmet/HSTS, CORS locked to production domains, request size limits.
- Check the admin MFA flow end to end (FR-11.3).

**Estimate:** 2 days, spread across the other tasks

---

## Summary

| ID | Task | Est. | Depends on |
|---|---|---|---|
| B01 | Harden notification queue | 1d | — |
| B02 | Delivery tracking | 1d | B01 |
| B03 | Real SMS OTP | 1d | DLT approval |
| B04 | Push / email / SMS channels | 2d | B01, B03 |
| B05 | Notification preferences | 0.5d | B04 |
| B06 | Razorpay adapter | 2–3d | Razorpay test account |
| B07 | Payment receipts | 1d | B06, B04 |
| B08 | Admin plans & refunds | 1d | B06 |
| B09 | R2 storage + upload validation | 1d | R2 bucket |
| B10 | Admin photo & verification queues | 1.5d | B09 |
| B11 | KYC adapter | 2d | Provider sandbox |
| B12 | Calling adapter | 1.5d | Provider account |
| B13 | Scheduled jobs | 1.5d | B04 |
| B14 | Production deployment | 2–3d | — |
| B15 | Security & test pass | 2d | all |

**Total: about 22–25 working days, roughly 4–5 weeks.**

**Accounts to request early** (they have lead times): DLT registration (SMS), MSG91, Razorpay
(test + live KYC), Firebase project, Resend, Cloudflare (R2), KYC provider sandbox, LiveKit.
