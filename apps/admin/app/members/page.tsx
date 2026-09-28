'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AccountStatus } from '@nadar-kalyanam/schemas';
import { Button, Card, Input, Select } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { StatusBadge } from '../../components/status-badge';
import { ApiError, listMembers, type MemberSummary } from '../../lib/api-client';
import { useAdminAuth } from '../providers/admin-auth-provider';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';

const PAGE_SIZE = 20;

export default function MembersPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AccountStatus | ''>('');
  const [verified, setVerified] = useState<'true' | 'false' | ''>('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | undefined>();

  // No separate `loading` boolean — `members === null` covers the initial
  // load, and a refetch (pagination/search change) just keeps showing the
  // previous page until the new one resolves, so setState only ever happens
  // inside the .then()/.catch() callbacks, never synchronously in the
  // effect body itself.
  useEffect(() => {
    if (!ready || !data.accessToken) return;
    let cancelled = false;
    listMembers(data.accessToken, {
      offset,
      limit: PAGE_SIZE,
      search: search || undefined,
      status: status || undefined,
      verified: verified || undefined,
      sort,
    })
      .then((result) => {
        if (!cancelled) {
          setMembers(result.items);
          setTotal(result.total);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load members.');
      });
    return () => {
      cancelled = true;
    };
  }, [ready, data.accessToken, offset, search, status, verified, sort]);

  if (!ready) return null;

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Members</h1>
        </div>

        <Card className="flex flex-col gap-3 rounded-2xl p-4 shadow-sm">
          <Input
            type="text"
            placeholder="Search by phone, name, or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select
              aria-label="Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as AccountStatus | '');
                setOffset(0);
              }}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="PENDING_DELETION">Pending deletion</option>
              <option value="DELETED">Deleted</option>
            </Select>
            <Select
              aria-label="Verification"
              value={verified}
              onChange={(e) => {
                setVerified(e.target.value as 'true' | 'false' | '');
                setOffset(0);
              }}
            >
              <option value="">Verified or not</option>
              <option value="true">Verified only</option>
              <option value="false">Not verified</option>
            </Select>
            <Select
              aria-label="Sort"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as 'newest' | 'oldest');
                setOffset(0);
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </Select>
          </div>
        </Card>

        {error && <Card className="rounded-2xl p-6 text-sm text-destructive">{error}</Card>}
        {members === null && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Loading…</Card>}

        {members && (
          <Card className="overflow-hidden rounded-2xl p-0 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Completion</th>
                  <th className="px-4 py-3">Verified</th>
                  <th className="px-4 py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/members/${member.id}`} className="font-medium text-primary hover:underline">
                        {member.fullName ?? '(no profile yet)'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{member.phoneNumber}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={member.status} />
                    </td>
                    <td className="px-4 py-3">{member.completionScore ?? '—'}</td>
                    <td className="px-4 py-3">{member.isVerified ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      No members match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total > 0 ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}` : ''}
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
      </div>
    </AdminShell>
  );
}
