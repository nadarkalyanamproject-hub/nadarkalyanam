-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('PAYMENT', 'ADMIN_GRANT');

-- CreateEnum
CREATE TYPE "VipEnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'ONBOARDED', 'CLOSED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "refundReason" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "refundedByAdminId" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledByAdminId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "grantReason" TEXT,
ADD COLUMN     "grantedByAdminId" TEXT,
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "source" "SubscriptionSource" NOT NULL DEFAULT 'PAYMENT';

-- CreateTable
CREATE TABLE "vip_enquiries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message" TEXT,
    "status" "VipEnquiryStatus" NOT NULL DEFAULT 'NEW',
    "assignedAdminId" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vip_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vip_enquiries_status_createdAt_idx" ON "vip_enquiries"("status", "createdAt");

-- CreateIndex
CREATE INDEX "vip_enquiries_userId_idx" ON "vip_enquiries"("userId");

-- AddForeignKey
ALTER TABLE "vip_enquiries" ADD CONSTRAINT "vip_enquiries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- At most one OPEN (NEW or CONTACTED) VIP enquiry per member. Partial unique
-- index, so it isn't expressed in schema.prisma.
CREATE UNIQUE INDEX "vip_enquiries_one_open_per_user" ON "vip_enquiries"("userId") WHERE "status" IN ('NEW', 'CONTACTED');

-- Backfill: every existing subscription came from a payment, and was created
-- when it started (the column didn't exist before).
UPDATE "subscriptions" SET "source" = 'PAYMENT', "createdAt" = "startedAt";
