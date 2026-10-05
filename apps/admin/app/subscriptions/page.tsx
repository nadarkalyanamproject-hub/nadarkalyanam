'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { SubscriptionSource, SubscriptionState } from '@nadar-kalyanam/schemas';
import { Button, Card, Input, Select } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { Dialog, GrantDialog, ReasonDialog, StateBadge } from '../../components/billing-ui';
import { ApiError } from '../../lib/api-client';
import { cancelSubscription, formatDate, listSubscriptions, type AdminSubscription } from '../../lib/billing-api';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';
import { useAdminAuth } from '../providers/admin-auth-provider';

const PLAN_CODES = ['GOLD', 'GOLD_PLUS', 'GOLD_PREMIUM', 'VIP_ASSISTED'];

export default function SubscriptionsPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const [state, setState] = useState<SubscriptionState | ''>('');
  const [planCode, setPlanCode] = useState('');
  const [source, setSource] = useState<SubscriptionSource | ''>('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<AdminSubscription[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminSubscription | null>(null);
  const [cancelling, setCancelling] = useState<AdminSubscription | null>(null);
  const [granting, setGranting] = useState(false);

  const load = useCallback(
    (cursor?: string) => {
      if (!data.accessToken) return;
      listSubscriptions(data.accessToken, { state: state || undefined, planCode: planCode || undefined, source: source || undefined, search: search.trim() || undefined, cursor })
        .then((r) => {
          setItems((prev) => (cursor && prev ? [...prev, ...r.items] : r.items));
          setNextCursor(r.nextCursor);
          setError(null);
        })
        .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load subscriptions.'));
    },
    [data.accessToken, state, planCode, source, search],
  );

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => load(), 250);
    return () => clearTimeout(timer);
  }, [ready, load]);

  if (!ready) return null;
  return (
    <AdminShell>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
            <p className="text-sm text-muted-foreground">Paid and granted plans. Queued plans start when the current one ends.</p>
          </div>
          <Button type="button" onClick={() => setGranting(true)} data-testid="open-grant">
            Grant plan
          </Button>
        </div>
        <Card className="grid grid-cols-1 gap-3 rounded-2xl p-4 sm:grid-cols-4">
          <Input placeholder="Member name or phone" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
          <Select value={state} onChange={(e) => setState(e.target.value as SubscriptionState | '')} aria-label="State">
            <option value="">Any state</option>
            {['ACTIVE', 'QUEUED', 'EXPIRED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={planCode} onChange={(e) => setPlanCode(e.target.value)} aria-label="Plan">
            <option value="">Any plan</option>
            {PLAN_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={source} onChange={(e) => setSource(e.target.value as SubscriptionSource | '')} aria-label="Source">
            <option value="">Any source</option>
            <option value="PAYMENT">Payment</option>
            <option value="ADMIN_GRANT">Admin grant</option>
          </Select>
        </Card>
        {message && <Card className="rounded-2xl p-4 text-sm text-muted-foreground" role="status">{message}</Card>}
        {error && <Card className="rounded-2xl p-4 text-sm text-destructive" role="alert">{error}</Card>}
        {items === null && !error && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Loading…</Card>}
        {items?.length === 0 && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">No subscriptions match.</Card>}
        {items && items.length > 0 && (
          <Card className="overflow-x-auto rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Member</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-t border-border" data-testid="subscription-row">
                    <td className="px-3 py-2">
                      <Link href={`/members/${s.member.userId}`} className="font-medium text-primary hover:underline">
                        {s.member.fullName ?? '(no profile)'}
                      </Link>
                      <div className="text-xs text-muted-foreground">{s.member.phoneNumber}</div>
                    </td>
                    <td className="px-3 py-2">{s.plan.name}</td>
                    <td className="px-3 py-2"><StateBadge state={s.state} /></td>
                    <td className="px-3 py-2 text-xs">{formatDate(s.startedAt)} – {formatDate(s.expiresAt)}</td>
                    <td className="px-3 py-2 text-xs">{s.source === 'ADMIN_GRANT' ? 'Grant' : 'Payment'}</td>
                    <td className="px-3 py-2 text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => setDetail(s)}>
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {nextCursor && (
          <Button type="button" variant="outline" onClick={() => load(nextCursor)}>
            Load more
          </Button>
        )}
      </div>

      {detail && (
        <Dialog title={`${detail.plan.name} — ${detail.member.fullName ?? detail.member.phoneNumber}`} onClose={() => setDetail(null)} testId="subscription-detail">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">State</dt><dd><StateBadge state={detail.state} /></dd>
            <dt className="text-muted-foreground">Period</dt><dd>{formatDate(detail.startedAt)} – {formatDate(detail.expiresAt)}</dd>
            <dt className="text-muted-foreground">Source</dt><dd>{detail.source === 'ADMIN_GRANT' ? `Granted by ${detail.grantedByEmail ?? 'admin'}` : `Order ${detail.orderId ?? '—'}`}</dd>
            {detail.grantReason && (<><dt className="text-muted-foreground">Grant reason</dt><dd>{detail.grantReason}</dd></>)}
            {detail.paymentReference && (<><dt className="text-muted-foreground">Offline payment ref</dt><dd>{detail.paymentReference}</dd></>)}
            <dt className="text-muted-foreground">Phone unlocks used</dt><dd>{detail.phoneUnlocksUsed}</dd>
            {detail.cancelledAt && (<><dt className="text-muted-foreground">Cancelled</dt><dd>{formatDate(detail.cancelledAt)} by {detail.cancelledByEmail ?? 'payment provider'}: {detail.cancelReason}</dd></>)}
          </dl>
          {(detail.state === 'ACTIVE' || detail.state === 'QUEUED') && (
            <div className="mt-4 flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={() => { setCancelling(detail); setDetail(null); }}>
                Cancel subscription
              </Button>
            </div>
          )}
        </Dialog>
      )}
      {cancelling && (
        <ReasonDialog
          title="Cancel subscription"
          testId="cancel-dialog"
          description={<>Ends {cancelling.member.fullName ?? 'this member'}&apos;s {cancelling.plan.name} now. Any queued plans move up to start immediately. Phone numbers already unlocked stay unlocked.</>}
          confirmLabel="Cancel subscription"
          onClose={() => setCancelling(null)}
          onConfirm={async (reason) => {
            await cancelSubscription(data.accessToken!, cancelling.id, reason);
            setMessage(`${cancelling.plan.name} cancelled for ${cancelling.member.fullName ?? cancelling.member.phoneNumber}.`);
            load();
          }}
        />
      )}
      {granting && (
        <GrantDialog
          onClose={() => setGranting(false)}
          onGranted={(s) => {
            setMessage(`${s.plan.name} granted to ${s.member.fullName ?? s.member.phoneNumber} (${formatDate(s.startedAt)} – ${formatDate(s.expiresAt)}).`);
            load();
          }}
        />
      )}
    </AdminShell>
  );
}
