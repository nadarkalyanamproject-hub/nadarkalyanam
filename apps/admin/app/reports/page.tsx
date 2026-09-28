'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ReportStatus } from '@nadar-kalyanam/schemas';
import { Button, Card, Select, Textarea } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { StatusBadge } from '../../components/status-badge';
import {
  ApiError,
  listReports,
  suspendMember,
  updateReport,
  type AdminReport,
  type ReportMemberSummary,
} from '../../lib/api-client';
import { useCurrentAdmin } from '../../lib/use-current-admin';
import { useAdminAuth } from '../providers/admin-auth-provider';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';

const PAGE_SIZE = 20;

type StatusFilter = ReportStatus | '';

function MemberLine({ label, member }: { label: string; member: ReportMemberSummary | null }) {
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-semibold uppercase tracking-wide">{label}:</span>{' '}
      {member ? (
        <>
          <Link href={`/members/${member.userId}`} className="font-medium text-primary hover:underline">
            {member.fullName ?? '(no profile)'}
          </Link>{' '}
          · {member.phoneNumber} · <StatusBadge status={member.status} />
        </>
      ) : (
        'no longer exists'
      )}
    </p>
  );
}

export default function ReportsPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const { can } = useCurrentAdmin();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [offset, setOffset] = useState(0);
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const [pendingId, setPendingId] = useState<string | null>(null);
  // The report whose close-with-note form is open, and which decision it's for.
  const [closing, setClosing] = useState<{ id: string; status: 'RESOLVED' | 'DISMISSED' } | null>(null);
  const [note, setNote] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    listReports(data.accessToken, { offset, limit: PAGE_SIZE, status: statusFilter || undefined })
      .then((result) => {
        if (!cancelled) {
          setReports(result.items);
          setTotal(result.total);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load reports.');
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken, statusFilter, offset, reloadKey]);

  async function run(id: string, action: () => Promise<unknown>, success: string) {
    setPendingId(id);
    setError(undefined);
    setMessage(undefined);
    try {
      await action();
      setMessage(success);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed.');
    } finally {
      setPendingId(null);
    }
  }

  function handleStartReview(report: AdminReport) {
    if (!data.accessToken) return;
    const token = data.accessToken;
    void run(report.id, () => updateReport(token, report.id, 'IN_REVIEW'), 'Report marked as in review.');
  }

  function handleClose() {
    if (!data.accessToken || !closing) return;
    const token = data.accessToken;
    const { id, status } = closing;
    void run(
      id,
      async () => {
        await updateReport(token, id, status, note.trim() || undefined);
        setClosing(null);
        setNote('');
      },
      status === 'RESOLVED' ? 'Report resolved.' : 'Report dismissed.',
    );
  }

  function handleSuspend(report: AdminReport) {
    const member = report.reportedMember;
    if (!data.accessToken || !member) return;
    const reason = window.prompt(
      `Reason for suspending ${member.fullName ?? member.phoneNumber}:`,
      `Report ${report.id.slice(0, 8)}: ${report.reason}`,
    );
    if (!reason) return;
    const token = data.accessToken;
    void run(report.id, () => suspendMember(token, member.userId, reason), 'Member suspended.');
  }

  if (!ready) return null;

  const isOpenView = statusFilter === '' || statusFilter === 'OPEN' || statusFilter === 'IN_REVIEW';

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <Select
            aria-label="Report status"
            className="w-56"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setOffset(0);
            }}
          >
            <option value="">Open queue (open + in review)</option>
            <option value="OPEN">Open</option>
            <option value="IN_REVIEW">In review</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </Select>
        </div>

        {error && <Card className="rounded-2xl p-4 text-sm text-destructive">{error}</Card>}
        {message && <Card className="rounded-2xl p-4 text-sm text-muted-foreground">{message}</Card>}
        {reports === null && !error && (
          <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Loading…</Card>
        )}

        {reports && reports.length === 0 && (
          <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
            {isOpenView ? 'No open reports.' : 'No reports with this status.'}
          </Card>
        )}

        {reports?.map((report) => {
          const busy = pendingId === report.id;
          const isOpen = report.status === 'OPEN' || report.status === 'IN_REVIEW';
          const member = report.reportedMember;
          return (
            <Card key={report.id} className="rounded-2xl p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={report.status} />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {report.targetType === 'MESSAGE' ? 'Message report' : 'Profile report'}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">Reason:</span> {report.reason}
                  </p>
                  {report.reportedMessage && (
                    <blockquote className="border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
                      “{report.reportedMessage.body}”
                    </blockquote>
                  )}
                  <MemberLine label="Reported" member={member} />
                  <MemberLine label="Reported by" member={report.reporter} />
                  {report.note && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold uppercase tracking-wide">Moderator note:</span> {report.note}
                    </p>
                  )}
                </div>

                {isOpen && (
                  <div className="flex flex-wrap gap-2">
                    {report.status === 'OPEN' && (
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => handleStartReview(report)}>
                        Start review
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setClosing({ id: report.id, status: 'RESOLVED' });
                        setNote('');
                      }}
                    >
                      Resolve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setClosing({ id: report.id, status: 'DISMISSED' });
                        setNote('');
                      }}
                    >
                      Dismiss
                    </Button>
                    {member && can('members.suspend') && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-destructive/50 text-destructive"
                        disabled={busy || member.status !== 'ACTIVE'}
                        title={member.status !== 'ACTIVE' ? `Member is ${member.status}` : undefined}
                        onClick={() => handleSuspend(report)}
                      >
                        Suspend member
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {closing?.id === report.id && (
                <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {closing.status === 'RESOLVED' ? 'Resolve report' : 'Dismiss report'}
                  </p>
                  <Textarea
                    className="mt-2"
                    aria-label="Note"
                    placeholder="Note for the audit log (optional)"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="mt-3 flex gap-2">
                    <Button type="button" size="sm" disabled={busy} onClick={handleClose}>
                      Confirm {closing.status === 'RESOLVED' ? 'resolve' : 'dismiss'}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setClosing(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </span>
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
        )}
      </div>
    </AdminShell>
  );
}
