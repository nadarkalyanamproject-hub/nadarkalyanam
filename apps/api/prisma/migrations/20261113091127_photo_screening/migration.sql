-- CreateEnum
CREATE TYPE "PhotoScreeningVerdict" AS ENUM ('CLEAR', 'REVIEW');

-- AlterTable
ALTER TABLE "profile_photos" ADD COLUMN     "screeningScores" JSONB,
ADD COLUMN     "screeningVerdict" "PhotoScreeningVerdict";
