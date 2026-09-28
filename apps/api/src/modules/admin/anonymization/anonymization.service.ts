import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { anonymizationCutoff } from '../member-removal.js';

// Per-run cap so one sweep can't hold the worker (or the DB) for long after
// a backlog builds up; the next scheduled run picks up the rest.
export const ANONYMIZATION_BATCH_SIZE = 50;

export const ANONYMIZE_ACTION = 'member.anonymize';
const SYSTEM_ACTOR = 'system:anonymization-job';
// Required-and-unique phoneNumber can't be nulled; a value derived from the
// user's own (random uuid) id is unique and says nothing about the person.
const anonymizedPhone = (userId: string) => `deleted:${userId}`;
// dateOfBirth is NOT NULL, so it's replaced with a fixed sentinel rather
// than cleared.
const SCRUBBED_DATE_OF_BIRTH = new Date('1900-01-01T00:00:00.000Z');

export interface AnonymizationRunResult {
  dryRun: boolean;
  eligible: string[];
  anonymized: string[];
  skipped: string[];
  failed: { userId: string; error: string }[];
}

// FR-1.5's final step for a removed member once their 14-day grace period
// has passed. Triggered by AnonymizationProcessor (only when
// ENABLE_ANONYMIZATION_JOB=true); holds no scheduling logic itself so it can
// be tested and invoked directly.
@Injectable()
export class AnonymizationService {
  private readonly logger = new Logger(AnonymizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // Eligible = PENDING_DELETION whose scheduled date (deletionRequestedAt +
  // grace period) is at or before `now`. A restored member is ACTIVE with
  // deletionRequestedAt cleared, and an already-anonymized one is DELETED,
  // so neither ever matches — that's what makes re-runs idempotent. Users
  // linked to an AdminUser are excluded defensively (removeMember refuses
  // them; anonymizing one would lock that admin out).
  findEligible(now: Date, limit: number) {
    return this.prisma.user.findMany({
      where: {
        status: 'PENDING_DELETION',
        deletionRequestedAt: { lte: anonymizationCutoff(now) },
        adminUser: null,
      },
      orderBy: { deletionRequestedAt: 'asc' },
      take: limit,
      select: { id: true, deletionRequestedAt: true },
    });
  }

  async run(options: { dryRun: boolean; now?: Date; batchSize?: number }): Promise<AnonymizationRunResult> {
    const now = options.now ?? new Date();
    const eligible = await this.findEligible(now, options.batchSize ?? ANONYMIZATION_BATCH_SIZE);
    const result: AnonymizationRunResult = {
      dryRun: options.dryRun,
      eligible: eligible.map((u) => u.id),
      anonymized: [],
      skipped: [],
      failed: [],
    };

    if (options.dryRun) {
      for (const user of eligible) {
        this.logger.log(
          `[DRY RUN] would anonymize userId=${user.id} (removal requested ${user.deletionRequestedAt?.toISOString()})`,
        );
      }
      this.logger.log(`[DRY RUN] ${eligible.length} member(s) eligible; nothing was changed`);
      return result;
    }

    // One user at a time, each in its own transaction: a failure (storage
    // outage, missing audit trail, ...) is logged and the loop moves on; that
    // user stays PENDING_DELETION and is retried on the next run.
    for (const user of eligible) {
      try {
        const outcome = await this.anonymizeUser(user.id, now);
        result[outcome].push(user.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to anonymize userId=${user.id}: ${message}`);
        result.failed.push({ userId: user.id, error: message });
      }
    }
    this.logger.log(
      `Anonymization run: ${result.anonymized.length} anonymized, ${result.skipped.length} skipped, ${result.failed.length} failed`,
    );
    return result;
  }

  async anonymizeUser(userId: string, now: Date): Promise<'anonymized' | 'skipped'> {
    // AuditLog.adminId is a required FK and this job has no admin identity
    // of its own, so the entry is attributed to the admin who requested the
    // removal (metadata.actor records that the job performed it). No
    // attributable removal = refuse rather than anonymize unaudited.
    const removal = await this.prisma.auditLog.findFirst({
      where: { action: 'member.remove', targetType: 'User', targetId: userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!removal) {
      throw new Error('no member.remove audit entry to attribute this anonymization to');
    }

    // Storage objects first, outside the transaction (S3 deletes can't roll
    // back). If any delete fails, this throws before the DB is touched and
    // the whole user is retried next run; S3 deletes are idempotent, so a
    // retry re-deleting an already-gone object is harmless. The reverse order
    // could commit DELETED with photo objects still in the bucket and no row
    // left pointing at them.
    const photos = await this.prisma.profilePhoto.findMany({
      where: { profile: { userId } },
      select: { objectKey: true },
    });
    for (const photo of photos) {
      await this.storage.deleteObject(photo.objectKey);
    }
    const deletedKeys = new Set(photos.map((p) => p.objectKey));

    const cutoff = anonymizationCutoff(now);
    const outcome = await this.prisma.$transaction(async (tx) => {
      // The claim: only flips a user who is STILL pending and past the
      // cutoff, so a concurrent run (or anything that changed their state
      // since findEligible) turns this into a no-op instead of a double run.
      const claimed = await tx.user.updateMany({
        where: { id: userId, status: 'PENDING_DELETION', deletionRequestedAt: { lte: cutoff } },
        data: { status: 'DELETED', phoneNumber: anonymizedPhone(userId) },
      });
      if (claimed.count === 0) {
        return null;
      }

      // Rows (re-read inside the transaction in case a photo was added after
      // the storage pass above) — their objects are cleaned up after commit.
      const remainingPhotos = await tx.profilePhoto.findMany({
        where: { profile: { userId } },
        select: { objectKey: true },
      });
      await tx.profilePhoto.deleteMany({ where: { profile: { userId } } });
      await tx.profile.updateMany({
        where: { userId },
        data: {
          fullName: 'Deleted member',
          gender: 'UNSPECIFIED',
          dateOfBirth: SCRUBBED_DATE_OF_BIRTH,
          visibility: 'HIDDEN',
          isVerified: false,
          completionScore: 0,
          details: {},
          fieldVisibility: {},
        },
      });
      const sessions = await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      // Push tokens identify the member's devices; their notification inbox
      // is only ever visible to them. Both are purely this user's own data.
      await tx.device.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });

      await tx.auditLog.create({
        data: {
          adminId: removal.adminId,
          action: ANONYMIZE_ACTION,
          targetType: 'User',
          targetId: userId,
          metadata: {
            actor: SYSTEM_ACTOR,
            removalRequestedByAdminId: removal.adminId,
            removalAuditLogId: removal.id,
            photosDeleted: photos.length + remainingPhotos.filter((p) => !deletedKeys.has(p.objectKey)).length,
            sessionsRevoked: sessions.count,
          },
        },
      });
      return { lateKeys: remainingPhotos.map((p) => p.objectKey).filter((key) => !deletedKeys.has(key)) };
    });

    if (!outcome) {
      return 'skipped';
    }
    for (const key of outcome.lateKeys) {
      await this.storage.deleteObject(key).catch((error: unknown) => {
        this.logger.error(`userId=${userId}: orphaned photo object ${key} could not be deleted: ${String(error)}`);
      });
    }
    this.logger.warn(`Anonymized userId=${userId}`);
    return 'anonymized';
  }
}
