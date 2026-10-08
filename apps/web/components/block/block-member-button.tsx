'use client';

import { useState } from 'react';
import { Ban } from 'lucide-react';
import { useRegistration } from '../../app/providers/registration-provider';
import { ApiError, blockMember } from '../../lib/api-client';

// Block with a confirmation step. What a block hides is decided by the API
// (the same rules every list and chat already use); this only creates it.
export function BlockMemberButton({
  target,
  memberName,
  onBlocked,
  appearance = 'pill',
}: {
  target: { targetUserId: string } | { targetProfileId: string };
  memberName: string;
  onBlocked: () => void;
  appearance?: 'pill' | 'compact';
}) {
  const { data } = useRegistration();
  const [confirming, setConfirming] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleConfirm() {
    if (!data.accessToken) return;
    setBlocking(true);
    setError(undefined);
    try {
      await blockMember(data.accessToken, target);
      setConfirming(false);
      onBlocked();
    } catch (err) {
      // Already blocked counts as done: the member is blocked either way.
      if (err instanceof ApiError && err.status === 409) {
        setConfirming(false);
        onBlocked();
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Could not block this member. Please try again.');
    } finally {
      setBlocking(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(undefined);
          setConfirming(true);
        }}
        data-testid="block-member"
        className={
          appearance === 'pill'
            ? 'inline-flex items-center justify-center gap-2 rounded-md border border-[#E2E8F0] bg-white px-5 py-2.5 text-sm font-semibold text-[#64748B] hover:bg-[#FAF8F5] hover:border-[#CBD5E1] hover:text-[#475569] transition-all active:scale-[0.98]'
            : 'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground'
        }
      >
        <Ban className={appearance === 'pill' ? 'h-4 w-4 text-[#8C6B6B]' : 'h-3.5 w-3.5'} aria-hidden="true" />
        <span>Block</span>
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" data-testid="block-confirm">
          <div role="dialog" aria-modal="true" aria-labelledby="block-confirm-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="block-confirm-title" className="text-base font-bold text-[#241C1A]">
              Block {memberName}?
            </h2>
            <p className="mt-2 text-sm text-[#5A493E]">
              You won&apos;t see each other in Search, Matches, Browse, Shortlist or Interests, and neither of you can
              message the other. You can unblock them later from Profile → Blocked members.
            </p>
            {error && (
              <p role="alert" className="mt-3 text-xs font-semibold text-destructive">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={blocking}
                className="rounded-md border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-[#FAF8F5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={blocking}
                className="rounded-md bg-[#7A1C32] px-5 py-2 text-xs font-semibold text-white hover:bg-[#681427] disabled:opacity-50"
              >
                {blocking ? 'Blocking…' : 'Block'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
