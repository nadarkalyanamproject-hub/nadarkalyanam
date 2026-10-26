'use client';

import { useEffect, useState } from 'react';
import type { BlockedMember } from '@nadar-kalyanam/schemas';
import { useRegistration } from '../../app/providers/registration-provider';
import { ApiError, listBlockedMembers, unblockMember } from '../../lib/api-client';
import { UserIcon } from '../app-header';

type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'loaded'; items: BlockedMember[] };

// Members the signed-in member has blocked, with Unblock. Unblocking brings
// them back into lists (unless they have blocked this member too).
export function BlockedMembersCard() {
  const { data } = useRegistration();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | undefined>();
  const accessToken = data.accessToken;

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    listBlockedMembers(accessToken)
      .then((result) => {
        if (!cancelled) setState({ kind: 'loaded', items: result.items });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ kind: 'error', message: err instanceof ApiError ? err.message : 'Could not load blocked members.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleUnblock(member: BlockedMember) {
    if (!accessToken) return;
    setPendingUserId(member.userId);
    setActionError(undefined);
    try {
      await unblockMember(accessToken, member.userId);
      setState((prev) =>
        prev.kind === 'loaded' ? { kind: 'loaded', items: prev.items.filter((m) => m.userId !== member.userId) } : prev,
      );
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not unblock. Please try again.');
    } finally {
      setPendingUserId(null);
    }
  }

  return (
    <div id="blocked-members" className="scroll-mt-24 rounded-2xl border border-nk-line bg-[#FFFFFF] p-6 shadow-sm" data-testid="blocked-members">
      <h2 className="font-[family-name:var(--font-body)] text-lg sm:text-xl font-bold tracking-tight text-nk-maroon">
        Blocked members
      </h2>
      <p className="mt-1 text-xs text-nk-muted">
        Blocked members don&apos;t see you and you don&apos;t see them anywhere, and neither of you can message the other.
      </p>

      {actionError && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-nk-maroon">
          {actionError}
        </p>
      )}

      {state.kind === 'loading' && <p className="mt-4 text-sm text-nk-muted">Loading…</p>}
      {state.kind === 'error' && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {state.message}
        </p>
      )}
      {state.kind === 'loaded' && state.items.length === 0 && (
        <p className="mt-4 text-sm text-nk-muted" data-testid="blocked-members-empty">
          You haven&apos;t blocked anyone.
        </p>
      )}
      {state.kind === 'loaded' && state.items.length > 0 && (
        <ul className="mt-3 divide-y divide-nk-line-soft">
          {state.items.map((member) => (
            <li key={member.userId} className="flex items-center gap-3 py-3" data-testid="blocked-member">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-nk-line bg-[#FAF6EF] text-[#A8988C]">
                {member.primaryPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.primaryPhotoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-nk-ink">{member.fullName}</p>
                <p className="text-xs text-nk-muted">Blocked {new Date(member.blockedAt).toLocaleDateString()}</p>
              </div>
              <button
                type="button"
                disabled={pendingUserId === member.userId}
                onClick={() => void handleUnblock(member)}
                className="shrink-0 rounded-lg border border-nk-line bg-nk-ivory px-3 py-1.5 text-xs font-semibold text-nk-maroon hover:bg-nk-cream disabled:opacity-60"
              >
                {pendingUserId === member.userId ? 'Unblocking…' : 'Unblock'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
