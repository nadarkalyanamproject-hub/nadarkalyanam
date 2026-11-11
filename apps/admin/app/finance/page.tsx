'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, IndianRupee, TrendingUp, Undo2 } from 'lucide-react';
import { Card } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { CHART_COLORS, LineChart } from '../../components/charts';
import { StatusBadge } from '../../components/status-badge';
import { ErrorNote, LoadingCard, PageHeader, SectionCard, Segmented, StatCard } from '../../components/ui/kit';
import { ApiError } from '../../lib/api-client';
import { getFinanceDashboard, rupees, type FinanceDashboard } from '../../lib/billing-api';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';
import { useAdminAuth } from '../providers/admin-auth-provider';

const RANGES = [7, 30, 90] as const;

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
        <PageHeader
          title="Finance"
          description="India time. Amounts include taxes. Recorded in this app only, so check settlements in your payment gateway."
          actions={<Segmented label="Range" value={days} onChange={setDays} options={RANGES.map((r) => ({ value: r, label: `${r} days` }))} />}
        />
        {error && <ErrorNote>{error}</ErrorNote>}
        {!dash && !error && <LoadingCard />}
        {dash && (
          <>
            {empty && <Card className="rounded-2xl p-5 text-sm text-muted-foreground" data-testid="finance-empty">No orders, refunds or plans in this range yet.</Card>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard testId="fin-gross" label="Gross revenue" value={rupees(dash.grossRevenueInPaise)} icon={<IndianRupee />} tone="accent" hint={`${dash.paidOrdersCount} paid ${dash.paidOrdersCount === 1 ? 'order' : 'orders'} (incl. later refunded)`} />
              <StatCard testId="fin-refunded" label="Refunded" value={rupees(dash.refundedInPaise)} icon={<Undo2 />} hint={`${dash.refundedCount} ${dash.refundedCount === 1 ? 'refund' : 'refunds'} recorded`} />
              <StatCard testId="fin-net" label="Net revenue" value={rupees(dash.netRevenueInPaise)} icon={<TrendingUp />} tone="good" hint="Gross minus refunds" />
              <StatCard testId="fin-expiring" label="Expiring in 7 days" value={String(dash.expiringNext7Days)} icon={<CalendarClock />} hint="Plans running now that end within a week" />
            </div>
            <SectionCard title="Revenue" description="Gross revenue per day, in rupees">
              <LineChart title="Gross revenue per day (₹)" points={dash.revenuePerDay.map((p) => ({ date: p.date, value: p.grossInPaise / 100 }))} color={CHART_COLORS.blue} testId="fin-chart" />
            </SectionCard>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <SectionCard testId="fin-statuses" title="Orders created, by status">
                {Object.keys(dash.ordersByStatus).length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">No orders.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {Object.entries(dash.ordersByStatus).map(([s, n]) => (
                      <li key={s} className="flex justify-between"><StatusBadge status={s} /><span className="tabular-nums">{n}</span></li>
                    ))}
                  </ul>
                )}
              </SectionCard>
              <SectionCard testId="fin-active" title="Active plans now">
                {dash.activeSubscriptionsByPlan.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">None.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {dash.activeSubscriptionsByPlan.map((p) => (
                      <li key={p.planCode} className="flex justify-between"><span>{p.planName}</span><span className="tabular-nums">{p.count}</span></li>
                    ))}
                  </ul>
                )}
                {dash.activeTrialsCount > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground" data-testid="fin-trials">
                    Plus {dash.activeTrialsCount} launch-offer free {dash.activeTrialsCount === 1 ? 'trial' : 'trials'} (not counted above).
                  </p>
                )}
              </SectionCard>
              <SectionCard testId="fin-grants" title="Admin grants">
                <p className="text-[28px] font-semibold leading-none tracking-tight tabular-nums">{dash.adminGrantsCount}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Never added to revenue. {dash.adminGrantsWithPaymentReference} carry an offline payment reference; offline payments are
                  not summed here.
                </p>
              </SectionCard>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
