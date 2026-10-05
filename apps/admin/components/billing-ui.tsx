'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { SubscriptionState } from '@nadar-kalyanam/schemas';
import { Button, Field, Input, Select, Textarea } from '@nadar-kalyanam/ui';
import { useAdminAuth } from '../app/providers/admin-auth-provider';
import { ApiError, listMembers, type MemberSummary } from '../lib/api-client';
import { grantSubscription, listPlans, rupees, type AdminPlan, type AdminSubscription } from '../lib/billing-api';

export function Dialog({ title, children, onClose, testId }: { title: string; children: ReactNode; onClose: () => void; testId?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" data-testid={testId}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const STATE_STYLE: Record<SubscriptionState, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  QUEUED: 'bg-sky-100 text-sky-800',
  EXPIRED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-red-100 text-red-800',
};

export function StateBadge({ state }: { state: SubscriptionState }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATE_STYLE[state]}`}>{state}</span>;
}

// A required-reason confirmation (cancel, refund).
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  testId,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
  testId?: string;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={title} onClose={onClose} testId={testId}>
      <div className="text-sm text-muted-foreground">{description}</div>
      <Field label="Reason (required)" htmlFor="reason" className="mt-3">
        <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
          Back
        </Button>
        <Button type="button" size="sm" disabled={busy || reason.trim().length < 3} onClick={() => void submit()}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

// Grant a plan (complimentary, or paid offline). It starts when the member's
// current plan ends, and is never counted as revenue.
export function GrantDialog({
  member,
  planCode,
  onClose,
  onGranted,
}: {
  member?: { userId: string; label: string };
  planCode?: string;
  onClose: () => void;
  onGranted: (subscription: AdminSubscription) => void;
}) {
  const { data } = useAdminAuth();
  const token = data.accessToken!;
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [planId, setPlanId] = useState('');
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<MemberSummary[]>([]);
  const [picked, setPicked] = useState(member ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPlans(token)
      .then((r) => {
        setPlans(r.items);
        const initial = r.items.find((p) => p.code === planCode) ?? r.items.find((p) => p.isActive);
        if (initial) {
          setPlanId(initial.id);
          setDays(String(initial.durationDays));
        }
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load plans.'));
  }, [token, planCode]);

  useEffect(() => {
    if (picked || search.trim().length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      listMembers(token, { search: search.trim(), limit: 8 })
        .then((r) => {
          if (!cancelled) setResults(r.items);
        })
        .catch(() => {});
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, search, picked]);

  const plan = plans.find((p) => p.id === planId);

  async function submit() {
    if (!picked || !plan) return;
    setBusy(true);
    setError(null);
    try {
      const granted = await grantSubscription(token, {
        memberId: picked.userId,
        planId: plan.id,
        durationDays: Number(days) || undefined,
        reason: reason.trim(),
        paymentReference: paymentReference.trim() || undefined,
      });
      onGranted(granted);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not grant the plan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Grant a plan" onClose={onClose} testId="grant-dialog">
      <p className="text-xs text-muted-foreground">
        Starts when the member&apos;s current plan ends (or now). Grants are never counted as revenue; a payment reference is
        kept for your records only.
      </p>
      <Field label="Member" htmlFor="grant-member" className="mt-3">
        {picked ? (
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
            <span data-testid="grant-member">{picked.label}</span>
            {!member && (
              <button type="button" className="text-xs text-primary underline" onClick={() => setPicked(null)}>
                Change
              </button>
            )}
          </div>
        ) : (
          <>
            <Input id="grant-member" placeholder="Search name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
            {results.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-border text-sm">
                {results.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-left hover:bg-muted"
                      onClick={() => setPicked({ userId: m.id, label: `${m.fullName ?? '(no profile)'} · ${m.phoneNumber}` })}
                    >
                      {m.fullName ?? '(no profile)'} · {m.phoneNumber}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Field>
      <Field label="Plan" htmlFor="grant-plan" className="mt-3">
        <Select
          id="grant-plan"
          value={planId}
          onChange={(e) => {
            setPlanId(e.target.value);
            const next = plans.find((p) => p.id === e.target.value);
            if (next) setDays(String(next.durationDays));
          }}
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({rupees(p.priceInPaise)}, {p.durationDays} days){p.isActive ? '' : ' — inactive'}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Duration (days)" htmlFor="grant-days" className="mt-3">
        <Input id="grant-days" type="number" min={1} max={1095} value={days} onChange={(e) => setDays(e.target.value)} />
      </Field>
      <Field label="Reason (required)" htmlFor="grant-reason" className="mt-3">
        <Textarea id="grant-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Field label="Offline payment reference (optional)" htmlFor="grant-ref" className="mt-3">
        <Input id="grant-ref" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="e.g. UPI ref, receipt no." />
      </Field>
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={busy || !picked || !plan || reason.trim().length < 3} onClick={() => void submit()}>
          {busy ? 'Granting…' : 'Grant plan'}
        </Button>
      </div>
    </Dialog>
  );
}
