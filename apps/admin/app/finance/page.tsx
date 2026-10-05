'use client';

import { useEffect, useState } from 'react';
import { Card } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { CHART_COLORS, LineChart } from '../../components/charts';
import { ApiError } from '../../lib/api-client';
import { getFinanceDashboard, rupees, type FinanceDashboard } from '../../lib/billing-api';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';
import { useAdminAuth } from '../providers/admin-auth-provider';

const RANGES = [7, 30, 90] as const;

function Stat({ label, value, note, testId }: { label: string; value: string; note?: string; testId: string }) {
  return (
    <Card className="rounded-2xl p-4" data-testid={testId}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </Card>
  );
}

export default function FinancePage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [dash, setDash] = useState<FinanceDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    getFinanceDashboard(data.accessToken, days)
      .then((d) => {
        if (!cancelled) {
          setDash(d);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load the finance dashboard.');
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken, days]);

  if (!ready) return null;
  const empty = dash && dash.paidOrdersCount === 0 && dash.refundedCount === 0 && dash.activeSubscriptionsByPlan.length === 0 && dash.adminGrantsCount === 0;

  return (
    <AdminShell>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Finance</h1>
            <p className="text-sm text-muted-foreground">India time. Amounts include taxes. Recorded in this app only — check settlements in your payment gateway.</p>
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Range">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={days === r}
                onClick={() => setDays(r)}
                className={`px-3 py-1.5 text-xs font-semibold ${days === r ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-muted'}`}
              >
                {r} days
              </button>
            ))}
          </div>
        </div>
        {error && <Card className="rounded-2xl p-4 text-sm text-destructive" role="alert">{error}</Card>}
        {!dash && !error && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Loading…</Card>}
        {dash && (
          <>
            {empty && <Card className="rounded-2xl p-4 text-sm text-muted-foreground" data-testid="finance-empty">No orders, refunds or plans in this range yet.</Card>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat testId="fin-gross" label="Gross revenue" value={rupees(dash.grossRevenueInPaise)} note={`${dash.paidOrdersCount} paid ${dash.paidOrdersCount === 1 ? 'order' : 'orders'} (incl. later refunded)`} />
              <Stat testId="fin-refunded" label="Refunded" value={rupees(dash.refundedInPaise)} note={`${dash.refundedCount} ${dash.refundedCount === 1 ? 'refund' : 'refunds'} recorded`} />
              <Stat testId="fin-net" label="Net revenue" value={rupees(dash.netRevenueInPaise)} note="Gross minus refunds" />
              <Stat testId="fin-expiring" label="Expiring in 7 days" value={String(dash.expiringNext7Days)} note="Plans running now that end within a week" />
            </div>
            <LineChart title="Gross revenue per day (₹)" points={dash.revenuePerDay.map((p) => ({ date: p.date, value: p.grossInPaise / 100 }))} color={CHART_COLORS.blue} testId="fin-chart" />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <Card className="rounded-2xl p-4" data-testid="fin-statuses">
                <h2 className="text-sm font-bold">Orders created, by status</h2>
                {Object.keys(dash.ordersByStatus).length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">No orders.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {Object.entries(dash.ordersByStatus).map(([s, n]) => (
                      <li key={s} className="flex justify-between"><span>{s}</span><span className="tabular-nums">{n}</span></li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="rounded-2xl p-4" data-testid="fin-active">
                <h2 className="text-sm font-bold">Active plans now</h2>
                {dash.activeSubscriptionsByPlan.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">None.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {dash.activeSubscriptionsByPlan.map((p) => (
                      <li key={p.planCode} className="flex justify-between"><span>{p.planName}</span><span className="tabular-nums">{p.count}</span></li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="rounded-2xl p-4" data-testid="fin-grants">
                <h2 className="text-sm font-bold">Admin grants</h2>
                <p className="mt-1 text-2xl font-bold tabular-nums">{dash.adminGrantsCount}</p>
                <p className="text-xs text-muted-foreground">
                  Never added to revenue. {dash.adminGrantsWithPaymentReference} carry an offline payment reference; offline payments are
                  not summed here.
                </p>
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
