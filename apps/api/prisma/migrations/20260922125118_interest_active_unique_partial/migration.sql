-- DropIndex
DROP INDEX "interests_senderId_targetId_key";

-- Uniqueness on (senderId, targetId) must be conditional: a WITHDRAWN
-- interest should not block sending a new one, but PENDING/ACCEPTED/DECLINED
-- must still be unique per pair. Prisma's schema DSL has no partial-index
-- syntax, so this is added by hand (same pattern as
-- profile_photos_profile_id_primary_unique).
CREATE UNIQUE INDEX "interests_sender_target_active_unique"
  ON "interests" ("senderId", "targetId")
  WHERE "status" IN ('PENDING', 'ACCEPTED', 'DECLINED');
