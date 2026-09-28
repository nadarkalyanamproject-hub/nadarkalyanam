// Display text, generated when notifications are READ (not stored), from
// the type plus the actor's current name — so a renamed member shows their
// current name, and no name/contact data sits in the notifications table.
export const SYSTEM_ACTOR_NAME = 'Nadar Kalyanam';

export function notificationMessage(type: string, actorName: string, data: Record<string, unknown>): string {
  switch (type) {
    case 'INTEREST_RECEIVED':
      return `${actorName} sent you an interest`;
    case 'INTEREST_ACCEPTED':
      return `${actorName} accepted your interest — you're now connected`;
    case 'PROFILE_VIEWED':
      return `${actorName} viewed your profile`;
    case 'NEW_MESSAGE': {
      const count = Number(data.count ?? 1);
      return count > 1 ? `${actorName} sent you ${count} new messages` : `${actorName} sent you a message`;
    }
    case 'ADMIN_PHOTO_REMOVED':
      return 'A photo was removed from your profile by our moderation team';
    case 'ACCOUNT_SUSPENDED':
      return 'Your account has been suspended. Please contact support for details.';
    case 'ACCOUNT_REINSTATED':
      return 'Your account has been reinstated';
    case 'REMOVAL_SCHEDULED': {
      const when = typeof data.scheduledAt === 'string' ? new Date(data.scheduledAt) : null;
      return when && !Number.isNaN(when.getTime())
        ? `Your account is scheduled for removal on ${when.toISOString().slice(0, 10)}`
        : 'Your account is scheduled for removal';
    }
    case 'REMOVAL_CANCELLED':
      return 'The scheduled removal of your account was cancelled';
    default:
      return 'You have a new notification';
  }
}
