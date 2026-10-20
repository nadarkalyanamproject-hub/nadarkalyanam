import type { ConfigService } from '@nestjs/config';
import type { Env } from '../modules/config/env.schema.js';

// Launch dates from the env (LAUNCH_DATE, LAUNCH_TRIAL_*), as UTC instants.
// Each date means 00:00 India time (UTC+05:30) on that day.
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function istMidnight(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS);
}

export interface LaunchTrialWindow {
  // Accounts created from here...
  signupFrom: Date;
  // ...that qualify before here (= launch) get the trial.
  qualifyBy: Date;
  startsAt: Date;
  endsAt: Date;
  durationDays: number;
  planCode: string;
}

// When matching opens; null when there's no pre-launch period.
export function launchAt(config: ConfigService<Env, true>): Date | null {
  const day = config.get('LAUNCH_DATE', { infer: true });
  return day ? istMidnight(day) : null;
}

export function isPreLaunch(config: ConfigService<Env, true>, now: Date = new Date()): boolean {
  const at = launchAt(config);
  return at !== null && now < at;
}

// The launch offer, or null when it isn't configured.
export function launchTrialWindow(config: ConfigService<Env, true>): LaunchTrialWindow | null {
  const at = launchAt(config);
  const from = config.get('LAUNCH_TRIAL_SIGNUP_FROM', { infer: true });
  if (!at || !from) return null;
  const durationDays = config.get('LAUNCH_TRIAL_DAYS', { infer: true });
  return {
    signupFrom: istMidnight(from),
    qualifyBy: at,
    startsAt: at,
    endsAt: new Date(at.getTime() + durationDays * DAY_MS),
    durationDays,
    planCode: config.get('LAUNCH_TRIAL_PLAN_CODE', { infer: true }),
  };
}
