'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, FileBarChart, ScrollText, ShieldCheck, Users } from 'lucide-react';
import { Card } from '@nadar-kalyanam/ui';
import { AdminShell } from '../components/admin-shell';
import { CHART_COLORS, DonutChart, LineChart } from '../components/charts';
import {
  ApiError,
  getDashboardStats,
  getMemberActivity,
  type DashboardStats,
  type MemberActivity,
} from '../lib/api-client';
import { useAdminAuth } from './providers/admin-auth-provider';
import { useRequireAdminAuth } from '../lib/use-require-admin-auth';
import { useCurrentAdmin } from '../lib/use-current-admin';

const WINDOWS = [7, 30, 90] as const;
type Window = (typeof WINDOWS)[number];

function StatCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Card className="rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </Card>
  );
}

// A real week-over-week figure; green + arrow only when it actually went up.
function Delta({ value, text, zeroText }: { value: number; text: string; zeroText: string }) {
  return value > 0 ? (
    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[#006300]" data-testid="delta">
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />+{value.toLocaleString('en-IN')} {text}
    </p>
  ) : (
    <p className="mt-1 text-xs text-muted-foreground" data-testid="delta">
      {zeroText}
    </p>
  );
}

export default function AdminHome() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const { can } = useCurrentAdmin();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [windowDays, setWindowDays] = useState<Window>(30);
  // Keyed by window, so switching shows "Loading…" until that window's data arrives.
  const [activity, setActivity] = useState<{ days: Window; data?: MemberActivity; error?: string } | null>(null);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    getDashboardStats(data.accessToken)
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load dashboard stats.');
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken]);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    getMemberActivity(data.accessToken, windowDays)
      .then((result) => {
        if (!cancelled) setActivity({ days: windowDays, data: result });
      })
      .catch((err: unknown) => {
        if (!cancelled) setActivity({ days: windowDays, error: err instanceof ApiError ? err.message : 'Could not load member activity.' });
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken, windowDays]);

  if (!ready) return null;
  const current = activity?.days === windowDays ? activity : null;

  const quickActions = [
    { href: '/members', label: 'View All Members', icon: Users, permission: 'members.view' },
    { href: '/audit-logs', label: 'View Audit Logs', icon: ScrollText, permission: 'admin_users.manage' },
    { href: '/admins', label: 'Manage Admins', icon: ShieldCheck, permission: 'admin_users.manage' },
  ].filter((action) => can(action.permission));

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

        {error && <Card className="rounded-2xl p-6 text-sm text-destructive">{error}</Card>}
        {!stats && !error && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Loading…</Card>}

        {stats && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total members">
                <p className="mt-2 text-3xl font-bold text-foreground" data-testid="stat-total">
                  {stats.totalMembers.toLocaleString('en-IN')}
                </p>
                {/* Accounts are never deleted (removal anonymizes the row), so
                    this week's growth is exactly this week's signups. */}
                <Delta value={stats.newSignupsLast7Days} text="this week" zeroText="No new members this week" />
              </StatCard>

              <StatCard label="Status breakdown">
                <div className="mt-3">
                  <DonutChart
                    centerLabel="members"
                    segments={[
                      { label: 'Active', value: stats.membersByStatus.active, color: CHART_COLORS.blue },
                      { label: 'Suspended', value: stats.membersByStatus.suspended, color: CHART_COLORS.orange },
                      { label: 'Pending deletion', value: stats.membersByStatus.pendingDeletion, color: CHART_COLORS.aqua },
                      { label: 'Deleted (anonymized)', value: stats.membersByStatus.deleted, color: CHART_COLORS.yellow },
                    ]}
                  />
                </div>
              </StatCard>

              <StatCard label="New signups (7 days)">
                <p className="mt-2 text-3xl font-bold text-foreground" data-testid="stat-new">
                  {stats.newSignupsLast7Days.toLocaleString('en-IN')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground" data-testid="stat-new-previous">
                  {stats.newSignupsPrevious7Days.toLocaleString('en-IN')} in the 7 days before
                </p>
              </StatCard>

              <StatCard label="Verified profiles">
                <p className="mt-2 text-3xl font-bold text-foreground" data-testid="stat-verified">
                  {stats.verifiedProfilesCount.toLocaleString('en-IN')}
                </p>
                <Delta value={stats.verificationsLast7Days} text="verified this week" zeroText="No verifications completed this week" />
              </StatCard>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="rounded-2xl p-5 shadow-sm lg:col-span-2" data-testid="member-activity">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Member activity</h2>
                    <p className="text-xs text-muted-foreground">Per day, India time</p>
                  </div>
                  <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Time range">
                    {WINDOWS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        aria-pressed={windowDays === days}
                        onClick={() => setWindowDays(days)}
                        className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                          windowDays === days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {days} days
                      </button>
                    ))}
                  </div>
                </div>

                {!current && <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>}
                {current?.error && <p className="py-16 text-center text-sm text-destructive">{current.error}</p>}
                {current?.data && (
                  // Two charts on a shared date axis rather than one chart with
                  // two y-scales: daily signups and the running total differ
                  // by orders of magnitude.
                  <div className="flex flex-col gap-4">
                    <LineChart
                      title="New signups per day"
                      color={CHART_COLORS.blue}
                      testId="chart-signups"
                      points={current.data.points.map((p) => ({ date: p.date, value: p.newSignups }))}
                    />
                    <LineChart
                      title="Total members"
                      color={CHART_COLORS.blue}
                      testId="chart-total"
                      points={current.data.points.map((p) => ({ date: p.date, value: p.totalMembers }))}
                    />
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View as table</summary>
                      <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-border">
                        <table className="w-full text-left tabular-nums" data-testid="activity-table">
                          <thead className="sticky top-0 bg-muted">
                            <tr>
                              <th className="px-3 py-1.5 font-semibold">Date</th>
                              <th className="px-3 py-1.5 text-right font-semibold">New signups</th>
                              <th className="px-3 py-1.5 text-right font-semibold">Total members</th>
                            </tr>
                          </thead>
                          <tbody>
                            {current.data.points.map((p) => (
                              <tr key={p.date} className="border-t border-border">
                                <td className="px-3 py-1">{p.date}</td>
                                <td className="px-3 py-1 text-right">{p.newSignups}</td>
                                <td className="px-3 py-1 text-right">{p.totalMembers}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </div>
                )}
              </Card>

              <Card className="rounded-2xl p-5 shadow-sm" data-testid="quick-actions">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Quick actions</h2>
                <div className="flex flex-col gap-2">
                  {quickActions.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
                    >
                      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                      {label}
                    </Link>
                  ))}
                  {/* Report generation is its own upcoming task: shown, not faked. */}
                  <div
                    aria-disabled="true"
                    className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-medium text-muted-foreground"
                    data-testid="quick-action-reports"
                  >
                    <span className="flex items-center gap-3">
                      <FileBarChart className="h-4 w-4" aria-hidden="true" />
                      Generate Reports
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      Coming soon
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            <Link href="/reports" className="block">
              <Card
                className={`rounded-2xl p-5 shadow-sm transition-colors ${
                  stats.pendingReportsCount > 0
                    ? 'border-2 border-destructive bg-destructive/5 hover:bg-destructive/10'
                    : 'hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Pending reports
                    </p>
                    <p
                      className={`mt-2 text-3xl font-bold ${
                        stats.pendingReportsCount > 0 ? 'text-destructive' : 'text-foreground'
                      }`}
                    >
                      {stats.pendingReportsCount}
                    </p>
                  </div>
                  {stats.pendingReportsCount > 0 && (
                    <span className="rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground">
                      Needs review
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {stats.pendingReportsCount > 0 ? 'Go to Reports queue →' : 'No open reports right now.'}
                </p>
              </Card>
            </Link>

            <Card className="overflow-hidden rounded-2xl p-0 shadow-sm">
              <div className="border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold text-foreground">Recent signups</h2>
              </div>
              {stats.recentSignups.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground">No members yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {stats.recentSignups.map((signup) => (
                      <tr key={signup.id} className="border-t border-border first:border-t-0 hover:bg-muted/40">
                        <td className="px-5 py-3">
                          <Link href={`/members/${signup.id}`} className="font-medium text-primary hover:underline">
                            {signup.fullName ?? '(no profile yet)'}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{signup.phoneNumber}</td>
                        <td className="px-5 py-3 text-right text-muted-foreground">
                          {new Date(signup.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        )}
      </div>
    </AdminShell>
  );
}
