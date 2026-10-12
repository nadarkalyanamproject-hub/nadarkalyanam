import type { RegistrationDraft } from './registration-types';

// Every tab of the app shares one stored draft (REGISTRATION_STORAGE_KEY),
// and the stored copy is the source of truth for the session tokens. The API
// rotates single-use refresh tokens and revokes the whole session when a
// spent one is presented again, so a tab must never write back tokens that
// another tab has since refreshed. These helpers decide what a tab writes and
// what it adopts; RegistrationProvider wires them to localStorage and the
// browser's "storage" event.

const TOKEN_KEYS = ['accessToken', 'refreshToken'] as const;

export function parseDraft(raw: string | null | undefined): RegistrationDraft {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as RegistrationDraft) : {};
  } catch {
    return {};
  }
}

type DraftKey = keyof RegistrationDraft;

function keysOf(...drafts: RegistrationDraft[]): DraftKey[] {
  return [...new Set(drafts.flatMap((draft) => Object.keys(draft) as DraftKey[]))];
}

function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

export function draftsEqual(a: RegistrationDraft, b: RegistrationDraft): boolean {
  return keysOf(a, b).every((key) => sameValue(a[key], b[key]));
}

// What to store after this tab's state went from `prev` (what it last synced
// with storage) to `next`, given what storage holds now (`stored`, possibly
// written by another tab since).
//  - Signing out, or signing in as a different account than storage holds:
//    this tab's state replaces storage wholesale, so no other account's draft
//    or tokens survive.
//  - Storage already belongs to a different account than this tab knows
//    about: this tab is stale, so it writes nothing and adopts storage.
//  - Otherwise only the fields this tab changed are merged in. Tokens are
//    merged only if storage still holds the refresh token this tab last saw
//    (or this tab just signed in); a newer pair from another tab always wins.
export function mergeDraftForWrite(
  stored: RegistrationDraft,
  prev: RegistrationDraft,
  next: RegistrationDraft,
): RegistrationDraft {
  if (prev.accessToken && !next.accessToken) return next;

  const changedAccount = Boolean(next.userId) && next.userId !== prev.userId;
  if (changedAccount && stored.userId !== next.userId) return next;
  if (stored.userId && next.userId && stored.userId !== next.userId) return stored;

  const canWriteTokens = !prev.accessToken || stored.refreshToken === prev.refreshToken;
  const result: RegistrationDraft = { ...stored };
  for (const key of keysOf(prev, next)) {
    if (sameValue(prev[key], next[key])) continue;
    if (!canWriteTokens && (TOKEN_KEYS as readonly DraftKey[]).includes(key)) continue;
    if (next[key] === undefined) delete result[key];
    else (result as Record<DraftKey, unknown>)[key] = next[key];
  }
  return result;
}

// A tab heard (via the "storage" event) that storage changed to `incoming`.
// `synced` is what this tab last synced with storage and `current` its state
// now. A different session (sign-out, sign-in, another account) is adopted
// wholesale; otherwise any edits this tab hasn't written yet are kept on top.
export function adoptStoredDraft(
  incoming: RegistrationDraft,
  synced: RegistrationDraft,
  current: RegistrationDraft,
): RegistrationDraft {
  const sameSession = incoming.userId === synced.userId && Boolean(incoming.accessToken) === Boolean(synced.accessToken);
  return sameSession ? mergeDraftForWrite(incoming, synced, current) : incoming;
}

// The signed-in account this tab was showing is gone (signed out, or another
// account signed in elsewhere), so whatever page it's on is stale.
export function lostSession(prev: RegistrationDraft, next: RegistrationDraft): boolean {
  return Boolean(prev.accessToken) && (!next.accessToken || next.userId !== prev.userId);
}
