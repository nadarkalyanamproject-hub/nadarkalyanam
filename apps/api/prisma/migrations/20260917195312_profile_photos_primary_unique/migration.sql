-- FR-2.6: enforce at most one primary photo per profile at the database level.
-- Prisma's schema DSL has no partial-index syntax, so this is added by hand.
CREATE UNIQUE INDEX "profile_photos_profile_id_primary_unique"
  ON "profile_photos" ("profileId")
  WHERE "isPrimary" = true;
