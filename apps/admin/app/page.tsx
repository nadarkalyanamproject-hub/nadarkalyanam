'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@nadar-kalyanam/ui';
import { AdminShell } from '../components/admin-shell';
import { ApiError, getDashboardStats, type DashboardStats } from '../lib/api-client';
import { useAdminAuth } from './providers/admin-auth-provider';
import { useRequireAdminAuth } from '../lib/use-require-admin-auth';

export default function AdminHome() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | undefined>();

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

  if (!ready) return null;

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

        {error && <Card className="rounded-2xl p-6 text-sm text-destructive">{error}</Card>}
        {!stats && !error && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Loading…</Card>}

        {stats && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total members</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{stats.totalMembers}</p>
              </Card>

              <Card className="rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status breakdown</p>
                <dl className="mt-2 flex flex-col gap-1 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Active</dt>
                    <dd className="font-semibold text-foreground">{stats.membersByStatus.active}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Suspended</dt>
                    <dd className="font-semibold text-foreground">{stats.membersByStatus.suspended}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Pending deletion</dt>
                    <dd className="font-semibold text-foreground">{stats.membersByStatus.pendingDeletion}</dd>
                  </div>
                </dl>
              </Card>

              <Card className="rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  New signups (7 days)
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">{stats.newSignupsLast7Days}</p>
              </Card>

              <Card className="rounded-2xl p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Verified profiles
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">{stats.verifiedProfilesCount}</p>
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
