import type { PhoneStatusResponse } from '@nadar-kalyanam/schemas';

// What the profile page shows for each phone-unlock state (unit-tested in
// phone-unlock.spec.ts). "Verified" here always means OTP-confirmed.
export interface PhoneUnlockView {
  message: string;
  action: 'unlock' | 'upgrade' | 'none';
  buttonLabel: string;
  // Shown before using a unit; null when nothing is used (unlimited plan or
  // re-showing an earlier unlock).
  confirm: string | null;
  allowance: string | null;
}

export function phoneUnlockView(status: PhoneStatusResponse): PhoneUnlockView {
  const none = { action: 'none' as const, buttonLabel: '', confirm: null, allowance: null };
  switch (status.state) {
    case 'NOT_CONNECTED':
      return { ...none, message: 'Available only after you’re connected (an accepted interest).' };
    case 'HIDDEN_BY_MEMBER':
      return { ...none, message: 'This member hasn’t chosen to share their phone number.' };
    case 'QUOTA_EXHAUSTED':
      return { ...none, message: `You’ve used all ${status.limit} phone number unlocks in your current plan.` };
    case 'NO_PLAN':
      return {
        ...none,
        action: 'upgrade',
        message: 'Unlocking an OTP-verified phone number needs a paid plan.',
      };
    case 'UNLOCKED':
      return { message: 'You’ve unlocked this number before.', action: 'unlock', buttonLabel: 'Show number', confirm: null, allowance: null };
    case 'AVAILABLE': {
      const unlimited = status.limit === null;
      return {
        message: 'OTP-verified mobile number (confirmed by a one-time code, not an ID check).',
        action: 'unlock',
        buttonLabel: 'Unlock number',
        confirm: unlimited
          ? null
          : `This uses 1 of your ${status.limit} unlocks (${status.remaining} left). Unlocking the same member again later is free.`,
        allowance: unlimited ? null : `${status.remaining} of ${status.limit} unlocks left in your plan`,
      };
    }
  }
}
