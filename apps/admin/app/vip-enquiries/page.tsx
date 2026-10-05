'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { VipEnquiryStatus } from '@nadar-kalyanam/schemas';
import { Button, Card, Select, Textarea } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { GrantDialog } from '../../components/billing-ui';
import { ApiError } from '../../lib/api-client';
import { formatDate, listVipEnquiries, updateVipEnquiry, vipAssignees, type AdminVipEnquiry } from '../../lib/billing-api';
import { useCurrentAdmin } from '../../lib/use-current-admin';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';
import { useAdminAuth } from '../providers/admin-auth-provider';

// Mirrors the API's status flow (VIP_STATUS_FLOW).
const NEXT: Record<VipEnquiryStatus, VipEnquiryStatus[]> = { NEW: ['CONTACTED', 'CLOSED'], CONTACTED: ['ONBOARDED', 'CLOSED'], ONBOARDED: [], CLOSED: [] };

function EnquiryCard({
  enquiry,
  assignees,
  canGrant,
  onChange,
  onGrant,
}: {
  enquiry: AdminVipEnquiry;
  assignees: { id: string; email: string }[];
  canGrant: boolean;
  onChange: (id: string, body: { status?: VipEnquiryStatus; assignedAdminId?: string | null; adminNotes?: string }) => Promise<void>;
  onGrant: (e: AdminVipEnquiry) => void;
}) {
  const [notes, setNotes] = useState(enquiry.adminNotes ?? '');
  return (
    <Card className="rounded-2xl p-5 shadow-sm" data-testid="vip-row" data-status={enquiry.status}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/members/${enquiry.userId}`} className="font-semibold text-primary hover:underline">{enquiry.name}</Link>
          <p className="text-sm text-muted-foreground">{enquiry.phone} · {formatDate(enquiry.createdAt)}</p>
          {enquiry.message && <p className="mt-1 text-sm text-foreground">“{enquiry.message}”</p>}
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold" data-testid="vip-status">{enquiry.status}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {NEXT[enquiry.status].map((s) => (
          <Button key={s} type="button" size="sm" variant="outline" onClick={() => void onChange(enquiry.id, { status: s })}>
            Mark {s.toLowerCase()}
          </Button>
        ))}
        <Select
          aria-label="Assign to"
          value={enquiry.assignedAdminId ?? ''}
          onChange={(e) => void onChange(enquiry.id, { assignedAdminId: e.target.value || null })}
          className="w-auto"
        >
          <option value="">Unassigned</option>
          {assignees.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
        </Select>
        {canGrant && (
          <Button type="button" size="sm" onClick={() => onGrant(enquiry)} data-testid="vip-grant">
            Grant VIP plan
          </Button>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea aria-label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" />
        <Button type="button" size="sm" variant="outline" disabled={notes === (enquiry.adminNotes ?? '')} onClick={() => void onChange(enquiry.id, { adminNotes: notes })}>
          Save notes
        </Button>
      </div>
    </Card>
  );
}

export default function VipEnquiriesPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const { can } = useCurrentAdmin();
  const [status, setStatus] = useState<VipEnquiryStatus | ''>('');
  const [items, setItems] = useState<AdminVipEnquiry[] | null>(null);
  const [assignees, setAssignees] = useState<{ id: string; email: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [granting, setGranting] = useState<AdminVipEnquiry | null>(null);

  const load = useCallback(() => {
    if (!data.accessToken) return;
    listVipEnquiries(data.accessToken, { status: status || undefined, limit: 50 })
      .then((r) => {
        setItems(r.items);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load enquiries.'));
  }, [data.accessToken, status]);

  useEffect(() => {
    if (!ready || !data.accessToken) return;
    load();
    vipAssignees(data.accessToken).then((r) => setAssignees(r.items)).catch(() => {});
  }, [ready, data.accessToken, load]);

  async function change(id: string, body: { status?: VipEnquiryStatus; assignedAdminId?: string | null; adminNotes?: string }) {
    try {
      const updated = await updateVipEnquiry(data.accessToken!, id, body);
      setItems((prev) => prev?.map((e) => (e.id === id ? updated : e)) ?? prev);
      setMessage('Enquiry updated.');
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the enquiry.');
    }
  }

  if (!ready) return null;
  return (
    <AdminShell>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">VIP enquiries</h1>
            <p className="text-sm text-muted-foreground">Members who asked to be called about VIP Assisted, on their registered number.</p>
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value as VipEnquiryStatus | '')} aria-label="Status" className="w-auto">
            <option value="">All statuses</option>
            {(['NEW', 'CONTACTED', 'ONBOARDED', 'CLOSED'] as const).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
        {message && <Card className="rounded-2xl p-4 text-sm text-muted-foreground" role="status">{message}</Card>}
        {error && <Card className="rounded-2xl p-4 text-sm text-destructive" role="alert">{error}</Card>}
        {items === null && !error && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Loading…</Card>}
        {items?.length === 0 && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">No enquiries.</Card>}
        {items?.map((e) => (
          <EnquiryCard key={`${e.id}-${e.updatedAt}`} enquiry={e} assignees={assignees} canGrant={can('subscriptions.manage')} onChange={change} onGrant={setGranting} />
        ))}
      </div>
      {granting && (
        <GrantDialog
          member={{ userId: granting.userId, label: `${granting.name} · ${granting.phone}` }}
          planCode="VIP_ASSISTED"
          onClose={() => setGranting(null)}
          onGranted={(s) => setMessage(`${s.plan.name} granted to ${granting.name} (${formatDate(s.startedAt)} – ${formatDate(s.expiresAt)}).`)}
        />
      )}
    </AdminShell>
  );
}
