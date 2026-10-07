-- AlterTable
ALTER TABLE "membership_plans" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "vip_enquiry_notes" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "authorAdminId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_enquiry_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vip_enquiry_events" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vip_enquiry_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vip_enquiry_notes_enquiryId_createdAt_idx" ON "vip_enquiry_notes"("enquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "vip_enquiry_events_enquiryId_createdAt_idx" ON "vip_enquiry_events"("enquiryId", "createdAt");

-- AddForeignKey
ALTER TABLE "vip_enquiry_notes" ADD CONSTRAINT "vip_enquiry_notes_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "vip_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vip_enquiry_events" ADD CONSTRAINT "vip_enquiry_events_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "vip_enquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Keep any existing free-text VIP note as the first (legacy, author unknown)
-- note of its enquiry.
INSERT INTO "vip_enquiry_notes" ("id", "enquiryId", "authorAdminId", "body", "createdAt")
SELECT gen_random_uuid()::text, "id", NULL, "adminNotes", "updatedAt"
FROM "vip_enquiries" WHERE "adminNotes" IS NOT NULL AND btrim("adminNotes") <> '';

-- Plan copy must not state a free-interest number that can drift from
-- FREE_INTERESTS_PER_MONTH. Only the exact seeded label is changed, so a
-- label an admin already edited is left alone.
UPDATE "membership_plans" p
SET "entitlements" = jsonb_set(p."entitlements", '{features}', (
  SELECT jsonb_agg(
    CASE WHEN f->>'label' = 'Unlimited interests (free members: 5 a month)'
      THEN jsonb_set(f, '{label}', '"Unlimited interests (no monthly limit)"')
      ELSE f END
    ORDER BY ord)
  FROM jsonb_array_elements(p."entitlements"->'features') WITH ORDINALITY AS t(f, ord)
))
WHERE jsonb_typeof(p."entitlements"->'features') = 'array'
  AND p."entitlements"::text LIKE '%free members: 5 a month%';
