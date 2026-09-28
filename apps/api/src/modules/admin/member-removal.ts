// 14 days, matching FR-1.5's self-service account-deletion grace period —
// admin-initiated removal is the same underlying mechanism, just triggered
// by an admin instead of the member themselves. There is deliberately no
// separate "scheduled anonymization" column: deletionRequestedAt + this
// window IS the scheduled date. Restore (AdminService.restoreMember) and the
// anonymization job (AnonymizationService) both derive it from here, so the
// two can never disagree about which side of the deadline a member is on.
export const DELETION_GRACE_PERIOD_DAYS = 14;

const GRACE_PERIOD_MS = DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

export function scheduledAnonymizationDate(deletionRequestedAt: Date): Date {
  return new Date(deletionRequestedAt.getTime() + GRACE_PERIOD_MS);
}

// A PENDING_DELETION member whose deletionRequestedAt is at or before this
// instant has passed their scheduled date and is eligible for anonymization.
export function anonymizationCutoff(now: Date): Date {
  return new Date(now.getTime() - GRACE_PERIOD_MS);
}
