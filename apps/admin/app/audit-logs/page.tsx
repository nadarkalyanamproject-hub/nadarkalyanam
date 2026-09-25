'use client';

import { useEffect, useState } from 'react';
import { Card } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { ApiError, listAuditLogs, type AuditLogEntry } from '../../lib/api-client';
import { useAdminAuth } from '../providers/admin-auth-provider';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';

export default function AuditLogsPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    listAuditLogs(data.accessToken, { limit: 100 })
      .then(setEntries)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load audit log.'));
  }, [ready, data.accessToken]);

  if (!ready) return null;

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-foreground">Audit log</h1>

        {error && <Card className="rounded-2xl p-6 text-sm text-destructive">{error}</Card>}

        {entries && (
          <Card className="overflow-hidden rounded-2xl p-0 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-border">
                    <td className="px-4 py-3 text-muted-foreground">{entry.adminId}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{entry.action}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.targetType} · {entry.targetId}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No audit log entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
