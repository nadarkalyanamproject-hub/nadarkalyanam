# Nadar Kalyanam

Matrimonial platform monorepo, built against the [SRS v1.1](../../Matrimony%20site/SRS%20revised.docx). This is the **Phase 1 (Foundation)** scaffold — repositories, environments, Docker, CI, PostgreSQL/Prisma, Redis, logging, configuration and migrations. Subsequent phases (auth, profile, discovery, interests, matching, communication, calling, verification, payments, admin/safety, release) build on top of this.

## Structure

```
apps/
  api/     NestJS backend API (modular monolith, /api/v1)
  web/     Next.js member web app
  admin/   Next.js admin back-office
packages/
  ui/      Shared React components + Tailwind design tokens
  schemas/ Shared Zod schemas/DTOs consumed by both API and web/admin
```

## Stack

- **Backend:** NestJS 11 (native ESM), Prisma 7 (`@prisma/adapter-pg`), PostgreSQL, Redis (`ioredis`), `nestjs-pino` for structured logging, `@nestjs/terminus` for health checks.
- **Web/Admin:** Next.js 16, React 19, Tailwind CSS v4.
- **Monorepo tooling:** pnpm workspaces + Turborepo.

## Prerequisites

- Node.js 22+
- pnpm 11+ (`corepack enable` or `npm i -g pnpm`)
- Docker Desktop (for local Postgres/Redis)

## Getting started

```bash
pnpm install

# start Postgres (port 5439) and Redis (port 6380) — see docker-compose.yml
docker compose up -d

# copy env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
cp apps/admin/.env.local.example apps/admin/.env.local

# generate Prisma client and run the initial migration
pnpm --filter @nadar-kalyanam/api prisma:migrate

# build shared packages once before first run
pnpm --filter @nadar-kalyanam/schemas build

# run everything
pnpm dev
```

- API: http://localhost:4000/api/v1 (health check at `/api/v1/health`)
- Web: http://localhost:3000
- Admin: http://localhost:3001

Ports 5439/6380 were chosen because this development machine already has native PostgreSQL/Redis services and other projects' Docker containers bound to the more common ports — see `docker-compose.yml` if you need to change them.

## Data model

`apps/api/prisma/schema.prisma` implements the core entities from SRS Section 6 (users, sessions, profiles, photos, interests, conversations/messages, blocks/reports, membership plans/orders/payments, verification requests, admin users/audit log). Note: FR-2.6's "at most one primary photo per profile" constraint requires a partial unique index, which Prisma's schema DSL can't express directly — add it by hand to the generated migration SQL (`CREATE UNIQUE INDEX ... ON profile_photos (profile_id) WHERE is_primary`).

## Open decisions

The SRS flags several `APPROVAL REQUIRED` items that aren't resolved in this scaffold and should be finalized before the relevant phase starts: profile completion formula weights (FR-2.3), final v1 search filter list (FR-3), calling entitlement policy (FR-6.1), launch peak performance target (NFR-2.3), and verification attempt authority details (FR-8.6). See the SRS's Section 8.4 Approval Matrix.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run all apps in dev mode via Turborepo |
| `pnpm build` | Build all apps/packages |
| `pnpm lint` | Lint all apps/packages |
| `pnpm typecheck` | Typecheck all apps/packages |
| `pnpm test` | Run tests across the monorepo |
| `pnpm db:migrate` | Run Prisma migrations for the API |
