import { describe, expect, it, vi } from 'vitest';
import { createSessionRefresher, type SessionTokens } from '@nadar-kalyanam/ui/session-refresh';
import { adoptStoredDraft, lostSession, mergeDraftForWrite, parseDraft } from './draft-sync';
import type { RegistrationDraft } from './registration-types';

const session = (accessToken: string, refreshToken: string, userId = 'u1'): RegistrationDraft => ({
  accessToken,
  refreshToken,
  userId,
  hasProfile: true,
});

// Two tabs sharing one stored draft, with the real refresher on top.
function twoTabs() {
  let stored = JSON.stringify(session('a1', 'r1'));
  const fetchImpl = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ accessToken: 'a2', refreshToken: 'r2' }), { status: 200 })));
  const refresh = createSessionRefresher({
    apiBaseUrl: 'http://api',
    lockName: 'test',
    locks: undefined,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    read: () => parseDraft(stored),
    write: (tokens: SessionTokens) => {
      stored = JSON.stringify({ ...parseDraft(stored), ...tokens });
    },
  });
  return {
    refresh,
    fetchImpl,
    stored: () => parseDraft(stored),
    setStored: (draft: RegistrationDraft) => {
      stored = JSON.stringify(draft);
    },
  };
}

describe('cross-tab token handling', () => {
  it('the old whole-state write-back made a stale tab spend a used refresh token', async () => {
    const tabs = twoTabs();
    const tabA = session('a1', 'r1');
    await tabs.refresh('a1'); // tab B refreshes: storage now holds a2/r2, r1 is spent
    tabs.setStored({ ...tabA, stepInputs: { basicDetails: { fullName: 'Meena' } } }); // tab A writes its whole state back
    await tabs.refresh('a1'); // the next 401
    expect(tabs.fetchImpl).toHaveBeenCalledTimes(2);
    expect(tabs.fetchImpl).toHaveBeenLastCalledWith('http://api/auth/refresh', expect.objectContaining({ body: JSON.stringify({ refreshToken: 'r1' }) }));
  });

  it('a stale tab saving a change keeps the newer tokens, and its next 401 adopts them without spending a refresh token', async () => {
    const tabs = twoTabs();
    const tabA = session('a1', 'r1');
    await tabs.refresh('a1'); // tab B refreshes

    const edited = { ...tabA, stepInputs: { basicDetails: { fullName: 'Meena' } } };
    const written = mergeDraftForWrite(tabs.stored(), tabA, edited);
    tabs.setStored(written);

    expect(written).toMatchObject({ accessToken: 'a2', refreshToken: 'r2', stepInputs: { basicDetails: { fullName: 'Meena' } } });
    await expect(tabs.refresh('a1')).resolves.toEqual({ kind: 'refreshed', accessToken: 'a2' });
    expect(tabs.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("this tab's own refresh (already in storage) writes cleanly", () => {
    const stored = session('a2', 'r2');
    expect(mergeDraftForWrite(stored, session('a1', 'r1'), session('a2', 'r2'))).toEqual(stored);
  });

  it('never writes tokens over a pair storage has moved on from, even if this tab changed them', () => {
    const stored = session('a3', 'r3');
    expect(mergeDraftForWrite(stored, session('a1', 'r1'), session('a2', 'r2'))).toEqual(stored);
  });

  it("picking up another tab's write adopts its tokens and keeps this tab's unsaved edits", () => {
    const synced = session('a1', 'r1');
    const current = { ...synced, stepInputs: { personal: { religion: 'Hindu' } } };
    expect(adoptStoredDraft(session('a2', 'r2'), synced, current)).toEqual({ ...session('a2', 'r2'), stepInputs: { personal: { religion: 'Hindu' } } });
  });
});

describe('sign-out and sign-in across tabs', () => {
  const draft = { ...session('a1', 'r1'), basicDetails: { fullName: 'Meena' } as RegistrationDraft['basicDetails'] };

  it('signing out clears all of storage, not just the fields this tab knew about', () => {
    expect(mergeDraftForWrite({ ...draft, devOtp: '123456' }, draft, {})).toEqual({});
  });

  it('another tab signing out is adopted wholesale and leaves the page', () => {
    const current = { ...draft, stepInputs: { personal: { religion: 'Hindu' } } };
    expect(adoptStoredDraft({}, draft, current)).toEqual({});
    expect(lostSession(draft, {})).toBe(true);
  });

  it("signing in as a different account replaces another account's stored draft", () => {
    const next = { phoneNumber: '+919876543210', ...session('b1', 'rb1', 'u2') };
    expect(mergeDraftForWrite(draft, { phoneNumber: '+919876543210' }, next)).toEqual(next);
  });

  it('the same account signing in again resumes its stored draft', () => {
    // Storage (and this tab, synced with it) still hold the account's draft
    // without a session; signing back in keeps it.
    const signedOut: RegistrationDraft = { userId: 'u1', basicDetails: draft.basicDetails, phoneNumber: '+919876543210' };
    const next = { ...signedOut, ...session('a5', 'r5') };
    expect(mergeDraftForWrite(signedOut, signedOut, next)).toEqual(next);
  });

  it('a tab still on an account that was replaced elsewhere adopts storage instead of writing', () => {
    const other = session('b1', 'rb1', 'u2');
    expect(mergeDraftForWrite(other, draft, { ...draft, devOtp: '1' })).toEqual(other);
    expect(lostSession(draft, other)).toBe(true);
  });

  it('another account signing in elsewhere is adopted wholesale', () => {
    const other = session('b1', 'rb1', 'u2');
    expect(adoptStoredDraft(other, draft, { ...draft, stepInputs: { personal: { religion: 'Hindu' } } })).toEqual(other);
  });

  it('a token refresh elsewhere is not a lost session', () => {
    expect(lostSession(draft, { ...draft, accessToken: 'a2', refreshToken: 'r2' })).toBe(false);
  });
});

describe('parseDraft', () => {
  it('treats missing, corrupt or non-object storage as an empty draft', () => {
    expect(parseDraft(null)).toEqual({});
    expect(parseDraft('{oops')).toEqual({});
    expect(parseDraft('[1]')).toEqual({});
    expect(parseDraft('"x"')).toEqual({});
  });
});
