-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('MEMBERSHIP', 'HOROSCOPE_MATCH');

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_planId_fkey";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "kind" "OrderKind" NOT NULL DEFAULT 'MEMBERSHIP',
ADD COLUMN     "matchProfileId" TEXT,
ALTER COLUMN "planId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "horoscope_matches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horoscope_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "horoscope_matches_orderId_key" ON "horoscope_matches"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "horoscope_matches_userId_profileId_key" ON "horoscope_matches"("userId", "profileId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_planId_fkey" FOREIGN KEY ("planId") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_matchProfileId_fkey" FOREIGN KEY ("matchProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horoscope_matches" ADD CONSTRAINT "horoscope_matches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horoscope_matches" ADD CONSTRAINT "horoscope_matches_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horoscope_matches" ADD CONSTRAINT "horoscope_matches_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
