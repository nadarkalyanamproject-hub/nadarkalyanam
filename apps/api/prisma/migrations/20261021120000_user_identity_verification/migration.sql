-- DigiLocker identity check: when it was confirmed, and the name and date of
-- birth from the ID (never the Aadhaar number or the document itself).
ALTER TABLE "users" ADD COLUMN "identityVerifiedAt" TIMESTAMP(3),
ADD COLUMN "identityName" TEXT,
ADD COLUMN "identityDateOfBirth" TIMESTAMP(3);
