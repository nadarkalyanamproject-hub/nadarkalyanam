'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Select } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { ReasonDialog } from '../../components/billing-ui';
import {
  ApiError,
  approveVerification,
  listVerifications,
  rejectVerification,
  type QueuedVerification,
} from '../../lib/api-client';
import { useCurrentAdmin } from '../../lib/use-current-admin';
import { useAdminAuth } from '../providers/admin-auth-provider';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';

const PAGE_SIZE = 20;

const STATUS_BADGES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  SUCCEEDED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-muted text-muted-foreground',
};

export default function VerificationsPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const { can } = useCurrentAdmin();

  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [offset, setOffset] = useState(0);
  const [verifications, setVerifications] = useState<QueuedVerification[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<QueuedVerification | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const canReview = can('verification.review');

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    listVerifications(data.accessToken, {
      offset,
      limit: PAGE_SIZE,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    })
      .then((result) => {
        if (!cancelled) {
          setVerifications(result.items);
          setTotal(result.total);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load verifications.');
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken, statusFilter, offset, reloadKey]);

  async function handleApprove(item: QueuedVerification) {
    if (!data.accessToken) return;
    setPendingId(item.id);
    setError(undefined);
    setMessage(undefined);
    try {
      await approveVerification(data.accessToken, item.id);
      setMessage(`Verification for ${item.memberName ?? item.phoneNumber} approved.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not approve verification.');
    } finally {
      setPendingId(null);
    }
  }

  async function handleReject(reason: string) {
    if (!data.accessToken || !rejectingItem) return;
    setPendingId(rejectingItem.id);
    setError(undefined);
    setMessage(undefined);
    try {
      await rejectVerification(data.accessToken, rejectingItem.id, reason || undefined);
      setMessage(`Verification for ${rejectingItem.memberName ?? rejectingItem.phoneNumber} rejected.`);
      setRejectingItem(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject verification.');
      throw err;
    } finally {
      setPendingId(null);
    }
  }

  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Identity Verifications</h1>
          <p className="text-sm text-muted-foreground">
            Review and manage member identity verification requests.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="rounded-lg bg-emerald-500/10 p-4 text-sm text-emerald-800">
            {message}
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Status:</span>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setOffset(0);
              }}
            >
              <option value="PENDING">Pending</option>
              <option value="SUCCEEDED">Succeeded</option>
              <option value="FAILED">Failed</option>
              <option value="EXPIRED">Expired</option>
              <option value="ALL">All Requests</option>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-medium">
              {total} {total === 1 ? 'request' : 'requests'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((k) => k + 1)}
              disabled={!ready}
            >
              Refresh
            </Button>
          </div>
        </div>

        {!verifications ? (
          <Card className="animate-pulse p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-muted" />
              ))}
            </div>
          </Card>
        ) : verifications.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-base font-semibold text-foreground">No verification requests found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter === 'PENDING'
                ? 'All identity verification requests have been processed.'
                : 'No records matching this filter.'}
            </p>
          </Card>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Profile Badge</th>
                  <th className="px-4 py-3">Request Status</th>
                  <th className="px-4 py-3">Provider Reference</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {verifications.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <Link
                        href={`/members/${item.userId}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {item.memberName ?? 'Unnamed Member'}
                      </Link>
                      <p className="text-xs text-muted-foreground">{item.phoneNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      {item.isProfileVerified ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          Not Verified
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_BADGES[item.status] ?? 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {item.providerReference}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.status === 'PENDING' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={!canReview || pendingId === item.id}
                            onClick={() => void handleApprove(item)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10"
                            disabled={!canReview || pendingId === item.id}
                            onClick={() => setRejectingItem(item)}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {item.decidedAt ? new Date(item.decidedAt).toLocaleDateString() : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {rejectingItem && (
          <ReasonDialog
            title="Reject Verification"
            description={
              <span>
                Reject verification request for{' '}
                <strong>{rejectingItem.memberName ?? rejectingItem.phoneNumber}</strong>.
              </span>
            }
            confirmLabel="Reject"
            onConfirm={handleReject}
            onClose={() => setRejectingItem(null)}
          />
        )}
      </div>
    </AdminShell>
  );
}
