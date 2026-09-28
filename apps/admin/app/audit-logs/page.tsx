'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Field, Input, Select } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { ApiError, listAdmins, listAuditLogs, type AdminSummary, type AuditLogEntry } from '../../lib/api-client';
import { AUDIT_ACTION_LABELS, auditActionLabel } from '../../lib/audit-actions';
import { useAdminAuth } from '../providers/admin-auth-provider';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';

const PAGE_SIZE = 50;

interface Filters {
  action: string;
  adminId: string;
  targetType: string;
  targetId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { action: '', adminId: '', targetType: '', targetId: '', from: '', to: '' };

// Date inputs give a calendar day; the range is inclusive of whole days in
// the admin's local time zone.
function toRange(filters: Filters) {
  return {
    from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
  };
}

function targetLink(entry: AuditLogEntry): string | null {
  if (entry.targetType === 'User') return `/members/${entry.targetId}`;
  const userId = entry.metadata?.userId;
  return typeof userId === 'string' ? `/members/${userId}` : null;
}

function metadataSummary(metadata: Record<string, unknown>): string {
  return Object.entries(metadata ?? {})
    .filter(([key]) => key !== 'userId')
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
    .join(' · ');
}

export default function AuditLogsPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [offset, setOffset] = useState(0);
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [admins, setAdmins] = useState<AdminSummary[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    listAdmins(data.accessToken)
      .then((result) => setAdmins(result.items))
      .catch(() => setAdmins([]));
  }, [ready, data.accessToken]);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    listAuditLogs(data.accessToken, {
      offset,
      limit: PAGE_SIZE,
      action: filters.action || undefined,
      adminId: filters.adminId || undefined,
      targetType: filters.targetType || undefined,
      targetId: filters.targetId.trim() || undefined,
      ...toRange(filters),
    })
      .then((result) => {
        if (!cancelled) {
          setEntries(result.items);
          setTotal(result.total);
          setError(undefined);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load audit log.');
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken, filters, offset]);

  if (!ready) return null;

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-foreground">Audit log</h1>

        <Card className="rounded-2xl p-4 shadow-sm">
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              setOffset(0);
              setFilters(draft);
            }}
          >
            <Field label="Action" htmlFor="filter-action">
              <Select
                id="filter-action"
                value={draft.action}
                onChange={(e) => setDraft({ ...draft, action: e.target.value })}
              >
                <option value="">All actions</option>
                {Object.entries(AUDIT_ACTION_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Admin" htmlFor="filter-admin">
              <Select
                id="filter-admin"
                value={draft.adminId}
                onChange={(e) => setDraft({ ...draft, adminId: e.target.value })}
              >
                <option value="">Any admin</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.email}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Target type" htmlFor="filter-target-type">
              <Select
                id="filter-target-type"
                value={draft.targetType}
                onChange={(e) => setDraft({ ...draft, targetType: e.target.value })}
              >
                <option value="">Any target</option>
                <option value="User">Member (User)</option>
                <option value="Profile">Profile</option>
                <option value="ProfilePhoto">Photo</option>
                <option value="Report">Report</option>
                <option value="AdminUser">Admin</option>
              </Select>
            </Field>
            <Field label="Target id" htmlFor="filter-target-id">
              <Input
                id="filter-target-id"
                placeholder="Exact id"
                value={draft.targetId}
                onChange={(e) => setDraft({ ...draft, targetId: e.target.value })}
              />
            </Field>
            <Field label="From" htmlFor="filter-from">
              <Input
                id="filter-from"
                type="date"
                value={draft.from}
                onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              />
            </Field>
            <Field label="To" htmlFor="filter-to">
              <Input
                id="filter-to"
                type="date"
                value={draft.to}
                onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              />
            </Field>
            <div className="flex gap-2 sm:col-span-3">
              <Button type="submit" size="sm">
                Apply filters
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraft(EMPTY_FILTERS);
                  setFilters(EMPTY_FILTERS);
                  setOffset(0);
                }}
              >
                Clear
              </Button>
            </div>
          </form>
        </Card>

        {error && <Card className="rounded-2xl p-6 text-sm text-destructive">{error}</Card>}

        {entries && (
          <Card className="overflow-x-auto rounded-2xl p-0 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const href = targetLink(entry);
                  return (
                    <tr key={entry.id} className="border-t border-border align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{entry.adminEmail}</td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {auditActionLabel(entry.action)}
                        <div className="text-xs font-normal text-muted-foreground">{entry.action}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {entry.targetType} ·{' '}
                        {href ? (
                          <Link href={href} className="text-primary hover:underline">
                            {entry.targetId.slice(0, 8)}
                          </Link>
                        ) : (
                          <span title={entry.targetId}>{entry.targetId.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className="max-w-xs break-words px-4 py-3 text-xs text-muted-foreground">
                        {metadataSummary(entry.metadata)}
                      </td>
                    </tr>
                  );
                })}
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No audit log entries match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total > 0 ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}` : ''}</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
