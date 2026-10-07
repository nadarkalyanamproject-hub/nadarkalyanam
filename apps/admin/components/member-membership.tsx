'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card } from '@nadar-kalyanam/ui';
import { useAdminAuth } from '../app/providers/admin-auth-provider';
import { ApiError } from '../lib/api-client';
import { formatDate, getMemberMembership, rupees, type MemberMembership as Data } from '../lib/billing-api';
import { useCurrentAdmin } from '../lib/use-current-admin';
import { GrantDialog, StateBadge } from './billing-ui';
import { MemberPhoneUnlocks } from './member-phone-unlocks';

// Member detail: their plans, phone-unlock and interest usage, recent
// orders, and a Grant plan button.
export function MemberMembership({ userId, memberLabel, disabled }: { userId: string; memberLabel: string; disabled?: boolean }) {
  const { data } = useAdminAuth();
  const { can } = useCurrentAdmin();
  const [info, setInfo] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!data.accessToken) return;
    getMemberMembership(data.accessToken, userId)
      .then(setInfo)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load membership.'));
  }, [data.accessToken, userId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="rounded-2xl p-6 shadow-sm" data-testid="member-membership">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-primary">Membership</h2>
        {can('subscriptions.manage') && !disabled && (
          <Button type="button" size="sm" onClick={() => setGranting(true)} data-testid="member-grant">
            Grant plan
          </Button>
        )}
      </div>
      {message && <p className="mb-2 text-sm text-muted-foreground" role="status">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {info && (
        <>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <p>
              <span className="text-muted-foreground">Phone unlocks this plan:</span>{' '}
              <span data-testid="member-unlocks">{info.phoneUnlocksThisPlan ?? '— (no active plan)'}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Phone unlocks ever:</span> {info.phoneUnlocksTotal}
            </p>
            <p>
              <span className="text-muted-foreground">Interests sent this month (IST):</span>{' '}
              <span data-testid="member-interests">{info.interestsSentThisMonth}</span>
            </p>
          </div>
          <h3 className="mt-4 text-sm font-bold">Plans</h3>
          {info.subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plans yet.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {info.subscriptions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2" data-testid="member-subscription">
                  <StateBadge state={s.state} />
                  <span>{s.plan.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(s.startedAt)} – {formatDate(s.expiresAt)} · {s.source === 'ADMIN_GRANT' ? `granted: ${s.grantReason ?? ''}` : 'payment'}
                    {s.cancelReason ? ` · cancelled: ${s.cancelReason}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-4 text-sm font-bold">Recent orders</h3>
          {info.recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {info.recentOrders.map((o) => (
                <li key={o.id}>
                  {o.plan.name} · {rupees(o.amountInPaise)} · {o.status} · {formatDate(o.createdAt)}
                </li>
              ))}
            </ul>
          )}
          <MemberPhoneUnlocks key={info.currentSubscriptionId ?? 'none'} userId={userId} />
        </>
      )}
      {granting && (
        <GrantDialog
          member={{ userId, label: memberLabel }}
          onClose={() => setGranting(false)}
          onGranted={(s) => {
            setMessage(`${s.plan.name} granted (${formatDate(s.startedAt)} – ${formatDate(s.expiresAt)}).`);
            load();
          }}
        />
      )}
    </Card>
  );
}
