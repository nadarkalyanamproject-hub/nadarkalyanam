-- CreateEnum
CREATE TYPE "PhoneVisibility" AS ENUM ('CONNECTED', 'NEVER');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "phoneVisibility" "PhoneVisibility" NOT NULL DEFAULT 'NEVER',
ADD COLUMN     "searchBoost" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "phone_unlocks" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "phone_unlocks_subscriptionId_idx" ON "phone_unlocks"("subscriptionId");

-- CreateIndex
CREATE INDEX "phone_unlocks_viewerId_createdAt_idx" ON "phone_unlocks"("viewerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "phone_unlocks_viewerId_targetUserId_key" ON "phone_unlocks"("viewerId", "targetUserId");

-- CreateIndex
CREATE INDEX "profiles_searchBoost_id_idx" ON "profiles"("searchBoost" DESC, "id");

-- CreateIndex
CREATE INDEX "profiles_searchBoost_createdAt_idx" ON "profiles"("searchBoost" DESC, "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "phone_unlocks" ADD CONSTRAINT "phone_unlocks_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_unlocks" ADD CONSTRAINT "phone_unlocks_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_unlocks" ADD CONSTRAINT "phone_unlocks_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: no existing member has ever consented to sharing their phone
-- number, so every existing profile is explicitly NEVER (also the column
-- default, DEFAULT_PHONE_VISIBILITY in packages/schemas).
UPDATE "profiles" SET "phoneVisibility" = 'NEVER';

-- One-time backfill of the listing tier from each member's current plan.
-- Mirrors PLAN_SEARCH_BOOST in apps/api/src/common/search-boost.ts (Gold
-- Plus 1, Gold Premium and VIP Assisted 2, everything else 0); from now on
-- recomputeSearchBoost maintains it.
UPDATE "profiles" p SET "searchBoost" = COALESCE((
  SELECT MAX(CASE mp."code" WHEN 'GOLD_PLUS' THEN 1 WHEN 'GOLD_PREMIUM' THEN 2 WHEN 'VIP_ASSISTED' THEN 2 ELSE 0 END)
  FROM "subscriptions" s JOIN "membership_plans" mp ON mp."id" = s."planId"
  WHERE s."userId" = p."userId" AND s."cancelledAt" IS NULL AND s."startedAt" <= now() AND s."expiresAt" > now()
), 0);
