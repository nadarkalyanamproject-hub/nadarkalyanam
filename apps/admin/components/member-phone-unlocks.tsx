'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@nadar-kalyanam/ui';
import { useAdminAuth } from '../app/providers/admin-auth-provider';
import { ApiError } from '../lib/api-client';
import { formatDate, getMemberPhoneUnlocks, type MemberPhoneUnlocks as Data } from '../lib/billing-api';

const PAGE = 20;

// Member detail: phone-unlock usage, read-only. Names, ids and dates only —
// this view never shows a phone number.
export function MemberPhoneUnlocks({ userId }: { userId: string }) {
  const { data } = useAdminAuth();
  const [info, setInfo] = useState<Data | null>(null);
  const [made, setMade] = useState<Data['made']>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    (offset: number) => {
      if (!data.accessToken) return;
      getMemberPhoneUnlocks(data.accessToken, userId, { offset, limit: PAGE })
        .then((r) => {
          setInfo(r);
          setMade((prev) => (offset === 0 ? r.made : [...prev, ...r.made]));
        })
        .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load phone unlocks.'))
        .finally(() => setLoadingMore(false));
    },
    [data.accessToken, userId],
  );

  useEffect(() => {
    load(0);
  }, [load]);

  return (
    <div className="mt-5 border-t border-border pt-4" data-testid="member-phone-unlocks">
      <h3 className="text-sm font-bold">Phone unlocks</h3>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {info && (
        <>
          <div className="mt-1 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <p>
              <span className="text-muted-foreground">Current plan:</span>{' '}
              <span data-testid="unlocks-current">
                {info.currentPlan
                  ? `${info.currentPlan.used} of ${info.currentPlan.limit ?? 'unlimited'} used (${info.currentPlan.planName})`
                  : 'No active plan'}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Numbers they unlocked:</span> <span data-testid="unlocks-made-total">{info.madeTotal}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Times their number was unlocked:</span>{' '}
              <span data-testid="unlocks-received">{info.receivedCount}</span>
            </p>
          </div>
          {made.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">They haven&apos;t unlocked any numbers.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm" data-testid="unlocks-made">
              {made.map((u) => (
                <li key={`${u.targetUserId}-${u.unlockedAt}`}>
                  <Link href={`/members/${u.targetUserId}`} className="font-semibold text-primary hover:underline">
                    {u.targetName ?? u.targetUserId}
                  </Link>{' '}
                  <span className="text-xs text-muted-foreground">
                    · {formatDate(u.unlockedAt)} · {u.planName}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {info.nextOffset !== null && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={loadingMore}
              onClick={() => {
                setLoadingMore(true);
                load(info.nextOffset!);
              }}
            >
              {loadingMore ? 'Loading…' : 'Show more'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
