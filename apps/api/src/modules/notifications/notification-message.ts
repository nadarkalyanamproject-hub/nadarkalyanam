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
    case 'PLAN_ACTIVATED': {
      const plan = typeof data.planName === 'string' ? `Your ${data.planName}` : 'Your';
      const until = typeof data.expiresAt === 'string' ? new Date(data.expiresAt) : null;
      return until && !Number.isNaN(until.getTime())
        ? `${plan} membership is active until ${until.toISOString().slice(0, 10)}`
        : `${plan} membership is active`;
    }
    case 'PLAN_EXPIRED':
      return typeof data.planName === 'string' ? `Your ${data.planName} membership has ended` : 'Your membership has ended';
    default:
      return 'You have a new notification';
  }
}
