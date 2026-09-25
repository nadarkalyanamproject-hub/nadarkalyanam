'use client';

import { useEffect, useState } from 'react';
import type { ReportResponse } from '@nadar-kalyanam/schemas';
import { Button, Card } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { ApiError, listReports, resolveReport } from '../../lib/api-client';
import { useAdminAuth } from '../providers/admin-auth-provider';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';

export default function ReportsPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const [reports, setReports] = useState<ReportResponse[] | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function reload() {
    if (!data.accessToken) return;
    listReports(data.accessToken, { limit: 50 })
      .then((result) => setReports(result.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load reports.'));
  }

  useEffect(() => {
    if (!ready) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function handleResolve(id: string, status: 'RESOLVED' | 'DISMISSED') {
    if (!data.accessToken) return;
    setPendingId(id);
    try {
      await resolveReport(data.accessToken, id, status);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update report.');
    } finally {
      setPendingId(null);
    }
  }

  if (!ready) return null;

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-foreground">Reports queue</h1>

        {error && <Card className="rounded-2xl p-6 text-sm text-destructive">{error}</Card>}

        {reports && reports.length === 0 && (
          <Card className="rounded-2xl p-6 text-sm text-muted-foreground">No open reports.</Card>
        )}

        {reports?.map((report) => (
          <Card key={report.id} className="rounded-2xl p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {report.targetType} · {report.status}
                </p>
                <p className="mt-1 text-sm text-foreground">{report.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reported by {report.reporterId} on {new Date(report.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={pendingId === report.id}
                  onClick={() => void handleResolve(report.id, 'RESOLVED')}
                >
                  Resolve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pendingId === report.id}
                  onClick={() => void handleResolve(report.id, 'DISMISSED')}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
