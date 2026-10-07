-- CreateEnum
CREATE TYPE "HoroscopeVisibility" AS ENUM ('EVERYONE', 'CONNECTED', 'HIDDEN');

-- CreateTable
CREATE TABLE "partner_preferences" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "heightMinCm" INTEGER,
    "heightMaxCm" INTEGER,
    "maritalStatuses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "motherTongues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "states" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "incomeMinLakhs" DOUBLE PRECISION,
    "incomeMaxLakhs" DOUBLE PRECISION,
    "doshamPreference" TEXT NOT NULL DEFAULT 'DOESNT_MATTER',
    "mustHaveAge" BOOLEAN NOT NULL DEFAULT false,
    "mustHaveMaritalStatus" BOOLEAN NOT NULL DEFAULT false,
    "mustHaveLocation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_horoscopes" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "birthTime" TEXT,
    "birthCity" TEXT,
    "birthState" TEXT,
    "birthCountry" TEXT,
    "rasi" TEXT,
    "nakshatra" TEXT,
    "nakshatraPada" INTEGER,
    "lagnam" TEXT,
    "sevvaiDosham" TEXT,
    "raguKethuDosham" TEXT,
    "visibility" "HoroscopeVisibility" NOT NULL DEFAULT 'HIDDEN',
    "shareBirthDetails" BOOLEAN NOT NULL DEFAULT false,
    "chartObjectKey" TEXT,
    "chartIsModerated" BOOLEAN NOT NULL DEFAULT false,
    "chartIsApproved" BOOLEAN NOT NULL DEFAULT false,
    "chartRejectionReason" TEXT,
    "chartUploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_horoscopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_preferences_profileId_key" ON "partner_preferences"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "profile_horoscopes_profileId_key" ON "profile_horoscopes"("profileId");

-- AddForeignKey
ALTER TABLE "partner_preferences" ADD CONSTRAINT "partner_preferences_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_horoscopes" ADD CONSTRAINT "profile_horoscopes_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

