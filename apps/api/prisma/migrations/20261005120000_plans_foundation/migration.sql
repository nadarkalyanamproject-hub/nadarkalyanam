-- Plans foundation: stable plan codes and limits, order/subscription links
-- for webhook hardening.

-- membership_plans: code is added nullable, backfilled for the four seeded
-- plans (any other row falls back to its id), then made required + unique.
ALTER TABLE "membership_plans" ADD COLUMN "code" TEXT;
ALTER TABLE "membership_plans" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "membership_plans" ADD COLUMN "phoneUnlockLimit" INTEGER;
ALTER TABLE "membership_plans" ADD COLUMN "isAssisted" BOOLEAN NOT NULL DEFAULT false;

UPDATE "membership_plans" SET "code" = 'GOLD', "sortOrder" = 1, "phoneUnlockLimit" = 50 WHERE "id" = 'plan-gold-3m';
UPDATE "membership_plans" SET "code" = 'GOLD_PLUS', "sortOrder" = 2, "phoneUnlockLimit" = NULL WHERE "id" = 'plan-gold-plus-3m';
UPDATE "membership_plans" SET "code" = 'GOLD_PREMIUM', "sortOrder" = 3, "phoneUnlockLimit" = NULL WHERE "id" = 'plan-gold-premium-12m';
UPDATE "membership_plans" SET "code" = 'VIP_ASSISTED', "sortOrder" = 4, "phoneUnlockLimit" = 75, "isAssisted" = true WHERE "id" = 'plan-vip-assisted-6m';
UPDATE "membership_plans" SET "code" = "id" WHERE "code" IS NULL;

ALTER TABLE "membership_plans" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "membership_plans_code_key" ON "membership_plans"("code");

-- orders
ALTER TABLE "orders" ADD COLUMN "providerOrderId" TEXT;
ALTER TABLE "orders" ADD COLUMN "paidAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "orders_providerOrderId_key" ON "orders"("providerOrderId");

-- subscriptions
ALTER TABLE "subscriptions" ADD COLUMN "orderId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "cancelledAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "subscriptions_orderId_key" ON "subscriptions"("orderId");
CREATE INDEX "subscriptions_userId_status_expiresAt_idx" ON "subscriptions"("userId", "status", "expiresAt");
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
