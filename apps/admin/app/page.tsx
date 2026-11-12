'use client';

import { formatDisplayDate } from '@nadar-kalyanam/schemas';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, BadgeCheck, ChevronRight, Flag, ScrollText, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { AdminShell } from '../components/admin-shell';
import { CHART_COLORS, DonutChart, LineChart } from '../components/charts';
import { RecentActivity } from '../components/recent-activity';
import { GenerateReport } from '../components/generate-report';
import { ErrorNote, LoadingCard, PageHeader, SectionCard, Segmented, StatCard } from '../components/ui/kit';
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

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const todayLabel = () => new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }).format(new Date());

// A real week-over-week figure; green + arrow only when it actually went up.
function Delta({ value, text, zeroText }: { value: number; text: string; zeroText: string }) {
  return value > 0 ? (
    <span className="inline-flex items-center gap-1" data-testid="delta">
      <span className="inline-flex items-center gap-0.5 font-medium tabular-nums text-good">
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />+{value.toLocaleString('en-IN')}
      </span>
      {text}
    </span>
  ) : (
    <span data-testid="delta">{zeroText}</span>
  );
}

export default function AdminHome() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const { can } = useCurrentAdmin();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [windowDays, setWindowDays] = useState<Window>(30);
  // Keyed by window, so switching shows "Loading" until that window's data arrives.
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
    { href: '/members', label: 'Find a member', icon: Users, permission: 'members.view' },
    { href: '/audit-logs', label: 'Audit log', icon: ScrollText, permission: 'admin_users.manage' },
    { href: '/admins', label: 'Manage admins', icon: ShieldCheck, permission: 'admin_users.manage' },
  ].filter((action) => can(action.permission));

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={greeting()} description={`Here is how Nadar Kalyanam is doing, ${todayLabel()}.`} />

        {error && <ErrorNote>{error}</ErrorNote>}
        {!stats && !error && <LoadingCard />}

        {stats && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {/* Accounts are never deleted (removal anonymizes the row), so
                  this week's growth is exactly this week's signups. */}
              <StatCard
                label="Total members"
                value={stats.totalMembers.toLocaleString('en-IN')}
                testId="stat-total"
                icon={<Users />}
                tone="accent"
                href="/members"
                hint={<Delta value={stats.newSignupsLast7Days} text="this week" zeroText="No new members this week" />}
              />
              <StatCard
                label="New signups, 7 days"
                value={stats.newSignupsLast7Days.toLocaleString('en-IN')}
                testId="stat-new"
                icon={<UserPlus />}
                hint={<span data-testid="stat-new-previous">{stats.newSignupsPrevious7Days.toLocaleString('en-IN')} in the 7 days before</span>}
              />
              <StatCard
                label="Verified profiles"
                value={stats.verifiedProfilesCount.toLocaleString('en-IN')}
                testId="stat-verified"
                icon={<BadgeCheck />}
                tone="good"
                hint={<Delta value={stats.verificationsLast7Days} text="verified this week" zeroText="No verifications completed this week" />}
              />
              <StatCard
                label="Reports to review"
                value={stats.pendingReportsCount}
                icon={<Flag />}
                tone={stats.pendingReportsCount > 0 ? 'bad' : 'neutral'}
                href="/reports"
                hint={stats.pendingReportsCount > 0 ? 'Open the reports queue' : 'No open reports right now'}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <SectionCard
                className="lg:col-span-2"
                testId="member-activity"
                title="Member activity"
                description="Per day, India time"
                actions={<Segmented label="Time range" value={windowDays} onChange={setWindowDays} options={WINDOWS.map((d) => ({ value: d, label: `${d} days` }))} />}
              >
                {!current && <p className="py-16 text-center text-sm text-muted-foreground">Loading</p>}
                {current?.error && <p className="py-16 text-center text-sm text-destructive">{current.error}</p>}
                {current?.data && (
                  // Two charts on a shared date axis rather than one chart with
                  // two y-scales: daily signups and the running total differ
                  // by orders of magnitude.
                  <div className="flex flex-col gap-4">
                    <LineChart
                      title="New signups per day"
                      color={CHART_COLORS.maroon}
                      testId="chart-signups"
                      points={current.data.points.map((p) => ({ date: p.date, value: p.newSignups }))}
                    />
                    <LineChart
                      title="Total members"
                      color={CHART_COLORS.maroon}
                      testId="chart-total"
                      points={current.data.points.map((p) => ({ date: p.date, value: p.totalMembers }))}
                    />
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View as table</summary>
                      <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-border">
                        <table className="w-full text-left tabular-nums" data-testid="activity-table">
                          <thead className="sticky top-0 bg-card">
                            <tr>
                              <th className="px-3 py-1.5">Date</th>
                              <th className="px-3 py-1.5 text-right">New signups</th>
                              <th className="px-3 py-1.5 text-right">Total members</th>
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
              </SectionCard>

              <div className="flex flex-col gap-4">
                <SectionCard title="Members by status">
                  <DonutChart
                    centerLabel="members"
                    segments={[
                      { label: 'Active', value: stats.membersByStatus.active, color: CHART_COLORS.maroon },
                      { label: 'Suspended', value: stats.membersByStatus.suspended, color: CHART_COLORS.gold },
                      { label: 'Pending deletion', value: stats.membersByStatus.pendingDeletion, color: CHART_COLORS.teal },
                      { label: 'Deleted (anonymized)', value: stats.membersByStatus.deleted, color: CHART_COLORS.slate },
                    ]}
                  />
                </SectionCard>
                <SectionCard title="Quick actions" testId="quick-actions">
                  <div className="-mx-2 flex flex-col">
                    {quickActions.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-[14px] font-medium text-foreground transition-colors hover:bg-black/[0.03]"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="flex-1">{label}</span>
                        <ChevronRight className="h-4 w-4 text-faint" aria-hidden="true" />
                      </Link>
                    ))}
                    {data.accessToken && (
                      <div className="mt-2 px-2">
                        <GenerateReport accessToken={data.accessToken} />
                      </div>
                    )}
                  </div>
                </SectionCard>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {data.accessToken && <RecentActivity accessToken={data.accessToken} />}
              <SectionCard
                title="Recent signups"
                flush
                actions={
                  <Link href="/members" className="text-[13px] font-medium text-primary hover:underline">
                    All members
                  </Link>
                }
              >
                {stats.recentSignups.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-muted-foreground">No members yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {stats.recentSignups.map((signup) => (
                        <tr key={signup.id} className="border-t border-border">
                          <td className="px-5 py-3">
                            <Link href={`/members/${signup.id}`} className="font-medium text-foreground hover:text-primary">
                              {signup.fullName ?? '(no profile yet)'}
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">{signup.phoneNumber}</td>
                          <td className="px-5 py-3 text-right text-muted-foreground">{formatDisplayDate(signup.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </SectionCard>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
