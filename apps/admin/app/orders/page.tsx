'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { OrderStatus } from '@nadar-kalyanam/schemas';
import { Button, Card, Input, Select } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { Dialog, ReasonDialog, StateBadge } from '../../components/billing-ui';
import { ApiError } from '../../lib/api-client';
import {
  activateOrder,
  formatDate,
  getOrder,
  listOrders,
  ordersNeedingAttention,
  refundOrder,
  rupees,
  type AdminOrder,
  type AdminOrderDetail,
} from '../../lib/billing-api';
import { useCurrentAdmin } from '../../lib/use-current-admin';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';
import { useAdminAuth } from '../providers/admin-auth-provider';

const PAGE = 25;

function MemberCell({ order }: { order: AdminOrder }) {
  return (
    <>
      <Link href={`/members/${order.member.userId}`} className="font-medium text-primary hover:underline">
        {order.member.fullName ?? '(no profile)'}
      </Link>
      <div className="text-xs text-muted-foreground">{order.member.phoneNumber}</div>
    </>
  );
}

export default function OrdersPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const { can } = useCurrentAdmin();
  const token = data.accessToken;
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [orders, setOrders] = useState<{ items: AdminOrder[]; total: number } | null>(null);
  const [attention, setAttention] = useState<{ paidWithoutSubscription: AdminOrder[]; staleCreated: AdminOrder[] } | null>(null);
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [refunding, setRefunding] = useState<AdminOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    listOrders(token, { status: status || undefined, from: from || undefined, to: to || undefined, search: search.trim() || undefined, offset, limit: PAGE })
      .then((r) => {
        setOrders(r);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load orders.'));
    ordersNeedingAttention(token).then(setAttention).catch(() => {});
  }, [token, status, from, to, search, offset]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [ready, load]);

  async function openDetail(id: string) {
    if (!token) return;
    try {
      setDetail(await getOrder(token, id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the order.');
    }
  }

  async function activate(order: AdminOrder) {
    if (!token) return;
    setBusyId(order.id);
    try {
      const result = await activateOrder(token, order.id);
      setMessage(result.created ? `Plan activated for order ${order.id}.` : `Order ${order.id} already had its plan; nothing changed.`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not activate.');
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return null;
  const needs = (attention?.paidWithoutSubscription.length ?? 0) + (attention?.staleCreated.length ?? 0);

  return (
    <AdminShell>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">Membership orders and their payment events. Amounts include taxes.</p>
        </div>
        {message && <Card className="rounded-2xl p-4 text-sm text-muted-foreground" role="status">{message}</Card>}
        {error && <Card className="rounded-2xl p-4 text-sm text-destructive" role="alert">{error}</Card>}

        <Card className="rounded-2xl p-4" data-testid="orders-attention">
          <h2 className="text-sm font-bold text-foreground">Needs attention ({needs})</h2>
          {needs === 0 && <p className="mt-1 text-sm text-muted-foreground">Nothing needs attention.</p>}
          {attention?.paidWithoutSubscription.map((o) => (
            <div key={o.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm" data-testid="attention-paid">
              <span>
                Paid, but no plan: {o.member.fullName ?? o.member.phoneNumber} · {o.plan.name} · {rupees(o.amountInPaise)} · paid {formatDate(o.paidAt)}
              </span>
              {can('subscriptions.manage') && (
                <Button type="button" size="sm" disabled={busyId === o.id} onClick={() => void activate(o)}>
                  Activate plan for this paid order
                </Button>
              )}
            </div>
          ))}
          {attention?.staleCreated.map((o) => (
            <div key={o.id} className="mt-2 rounded-lg border border-border p-2 text-sm text-muted-foreground" data-testid="attention-stale">
              Created over 30 minutes ago and not paid: {o.member.fullName ?? o.member.phoneNumber} · {o.plan.name} · {rupees(o.amountInPaise)} · {formatDate(o.createdAt)}
            </div>
          ))}
        </Card>

        <Card className="grid grid-cols-1 gap-3 rounded-2xl p-4 sm:grid-cols-4">
          <Input placeholder="Member, phone or order id" value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} aria-label="Search" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value as OrderStatus | ''); setOffset(0); }} aria-label="Status">
            <option value="">Any status</option>
            {['CREATED', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'].map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setOffset(0); }} aria-label="From" />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setOffset(0); }} aria-label="To" />
        </Card>

        {orders === null && !error && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Loading…</Card>}
        {orders?.items.length === 0 && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">No orders match.</Card>}
        {orders && orders.items.length > 0 && (
          <Card className="overflow-x-auto rounded-2xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Member</th>
                  <th className="px-3 py-2">Plan</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {orders.items.map((o) => (
                  <tr key={o.id} className="border-t border-border" data-testid="order-row">
                    <td className="px-3 py-2"><MemberCell order={o} /></td>
                    <td className="px-3 py-2">{o.plan.name}</td>
                    <td className="px-3 py-2">{rupees(o.amountInPaise)}</td>
                    <td className="px-3 py-2 text-xs font-semibold">{o.status}</td>
                    <td className="px-3 py-2 text-xs">{formatDate(o.createdAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => void openDetail(o.id)}>Details</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {orders && orders.total > PAGE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{offset + 1}–{Math.min(offset + PAGE, orders.total)} of {orders.total}</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button>
              <Button type="button" size="sm" variant="outline" disabled={offset + PAGE >= orders.total} onClick={() => setOffset(offset + PAGE)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {detail && (
        <Dialog title={`Order ${detail.id.slice(0, 8)}…`} onClose={() => setDetail(null)} testId="order-detail">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Member</dt><dd>{detail.member.fullName ?? '(no profile)'} · {detail.member.phoneNumber}</dd>
            <dt className="text-muted-foreground">Plan</dt><dd>{detail.plan.name}</dd>
            <dt className="text-muted-foreground">Amount</dt><dd>{rupees(detail.amountInPaise)}</dd>
            <dt className="text-muted-foreground">Status</dt><dd>{detail.status}</dd>
            <dt className="text-muted-foreground">Paid</dt><dd>{formatDate(detail.paidAt)}</dd>
            <dt className="text-muted-foreground">Plan from order</dt><dd>{detail.subscription ? <StateBadge state={detail.subscription.state} /> : 'None'}</dd>
            {detail.refundedAt && (<><dt className="text-muted-foreground">Refunded</dt><dd>{formatDate(detail.refundedAt)} by {detail.refundedByEmail ?? 'payment provider'}: {detail.refundReason}</dd></>)}
          </dl>
          <h3 className="mt-4 text-sm font-bold">Payment events</h3>
          {detail.paymentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment events recorded.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-xs">
              {detail.paymentEvents.map((e) => (
                <li key={e.providerEventId} className="rounded border border-border p-2">
                  <span className="font-mono">{e.providerEventId}</span> · {e.type} · {e.amountInPaise !== null ? rupees(e.amountInPaise) : '—'} {e.currency ?? ''} · signature {e.signatureValid ? 'verified' : 'invalid'} · {new Date(e.processedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">Only events with a verified signature are stored; others are rejected.</p>
          {detail.status === 'PAID' && can('payments.refund') && (
            <div className="mt-4 flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={() => { setRefunding(detail); setDetail(null); }}>Record refund</Button>
            </div>
          )}
        </Dialog>
      )}
      {refunding && (
        <ReasonDialog
          title="Record refund"
          testId="refund-dialog"
          description={
            <>
              <p>
                Marks this {rupees(refunding.amountInPaise)} order refunded and ends its plan now; any queued plans start immediately.
                Phone numbers already unlocked stay unlocked.
              </p>
              <p className="mt-2 font-semibold text-foreground">This records the refund here. Return the money from your payment gateway.</p>
            </>
          }
          confirmLabel="Record refund"
          onClose={() => setRefunding(null)}
          onConfirm={async (reason) => {
            await refundOrder(token!, refunding.id, reason);
            setMessage(`Refund recorded for order ${refunding.id}. Remember to return the money in your payment gateway.`);
            load();
          }}
        />
      )}
    </AdminShell>
  );
}
