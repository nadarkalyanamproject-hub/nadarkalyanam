import { describe, expect, it } from 'vitest';
import { phoneUnlockView } from './phone-unlock';

describe('phoneUnlockView', () => {
  it('asks for confirmation with the real count before using a unit', () => {
    const view = phoneUnlockView({ state: 'AVAILABLE', limit: 50, remaining: 50 });
    expect(view).toMatchObject({ action: 'unlock', buttonLabel: 'Unlock number' });
    expect(view.confirm).toBe('This uses 1 of your 50 unlocks (50 left). Unlocking the same member again later is free.');
  });

  it('an unlimited plan shows no count and needs no confirmation', () => {
    const view = phoneUnlockView({ state: 'AVAILABLE', limit: null, remaining: null });
    expect(view.confirm).toBeNull();
    expect(view.allowance).toBeNull();
  });

  it('re-showing an earlier unlock costs nothing (no confirmation)', () => {
    expect(phoneUnlockView({ state: 'UNLOCKED', limit: 50, remaining: 49 })).toMatchObject({ action: 'unlock', confirm: null });
  });

  it('NO_PLAN links to the plans; HIDDEN_BY_MEMBER and NOT_CONNECTED are plain text with no upgrade nag', () => {
    expect(phoneUnlockView({ state: 'NO_PLAN', limit: null, remaining: null }).action).toBe('upgrade');
    expect(phoneUnlockView({ state: 'HIDDEN_BY_MEMBER', limit: 50, remaining: 10 }).action).toBe('none');
    expect(phoneUnlockView({ state: 'NOT_CONNECTED', limit: null, remaining: null }).action).toBe('none');
  });

  it('never says "ID verified"', () => {
    for (const state of ['AVAILABLE', 'NO_PLAN', 'UNLOCKED', 'HIDDEN_BY_MEMBER', 'NOT_CONNECTED', 'QUOTA_EXHAUSTED'] as const) {
      expect(JSON.stringify(phoneUnlockView({ state, limit: 50, remaining: 1 }))).not.toMatch(/ID verified/i);
    }
  });
});
