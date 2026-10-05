'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { Dialog } from '../../components/billing-ui';
import { ApiError } from '../../lib/api-client';
import { listPlans, rupees, updatePlan, type AdminPlan } from '../../lib/billing-api';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';
import { useAdminAuth } from '../providers/admin-auth-provider';

type Pending = { plan: AdminPlan; change: { name?: string; priceInPaise?: number; isActive?: boolean; sortOrder?: number }; summary: string };

function PlanRow({ plan, onSave }: { plan: AdminPlan; onSave: (p: Pending) => void }) {
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.priceInPaise / 100));
  const [sortOrder, setSortOrder] = useState(String(plan.sortOrder));
  const priceInPaise = Math.round(Number(price) * 100);
  const priceValid = Number.isFinite(priceInPaise) && priceInPaise > 0;

  function save() {
    const change: Pending['change'] = {};
    const parts: string[] = [];
    if (name.trim() !== plan.name) {
      change.name = name.trim();
      parts.push(`name to "${name.trim()}"`);
    }
    if (priceInPaise !== plan.priceInPaise) {
      change.priceInPaise = priceInPaise;
      parts.push(`price from ${rupees(plan.priceInPaise)} to ${rupees(priceInPaise)}`);
    }
    if (Number(sortOrder) !== plan.sortOrder) {
      change.sortOrder = Number(sortOrder);
      parts.push(`display order to ${sortOrder}`);
    }
    if (parts.length) onSave({ plan, change, summary: `Change ${plan.name}: ${parts.join(', ')}.` });
  }

  return (
    <Card className="rounded-2xl p-5 shadow-sm" data-testid="plan-row" data-plan-code={plan.code}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{plan.code}</p>
          <p className="text-sm text-muted-foreground">
            {plan.durationDays} days · phone unlocks {plan.phoneUnlockLimit ?? 'unlimited'}
            {plan.isAssisted ? ' · assisted' : ''} · {plan.activeSubscriptions} active
          </p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${plan.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>
          {plan.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">
          Name
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label={`${plan.code} name`} />
        </label>
        <label className="text-xs text-muted-foreground">
          Price (₹, incl. taxes)
          <Input type="number" min={1} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} aria-label={`${plan.code} price`} />
        </label>
        <label className="text-xs text-muted-foreground">
          Display order
          <Input type="number" min={0} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} aria-label={`${plan.code} order`} />
        </label>
      </div>
      {!priceValid && <p className="mt-1 text-xs text-destructive">Price must be more than ₹0.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!priceValid || !name.trim()} onClick={save}>
          Save changes
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onSave({
              plan,
              change: { isActive: !plan.isActive },
              summary: plan.isActive
                ? `Deactivate ${plan.name}? It disappears from the member Membership page and can't be ordered. Existing subscriptions are not affected.`
                : `Activate ${plan.name}? Members will see it on the Membership page again.`,
            })
          }
        >
          {plan.isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </Card>
  );
}

export default function PlansPage() {
  const { ready } = useRequireAdminAuth();
  const { data } = useAdminAuth();
  const [plans, setPlans] = useState<AdminPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const load = useCallback(() => {
    if (!data.accessToken) return;
    listPlans(data.accessToken)
      .then((r) => setPlans(r.items))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load plans.'));
  }, [data.accessToken]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function confirm() {
    if (!pending || !data.accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await updatePlan(data.accessToken, pending.plan.id, pending.change);
      setMessage(`${pending.plan.name} updated. Existing orders keep their original amount.`);
      setPending(null);
      setVersion((v) => v + 1);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save.');
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  return (
    <AdminShell>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plans</h1>
          <p className="text-sm text-muted-foreground">
            Name, price, active and display order apply to new orders only. Code, duration and limits are fixed — to change
            entitlements, create a new plan with a developer.
          </p>
        </div>
        {message && <Card className="rounded-2xl p-4 text-sm text-muted-foreground" role="status">{message}</Card>}
        {error && <Card className="rounded-2xl p-4 text-sm text-destructive" role="alert">{error}</Card>}
        {!plans && !error && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Loading…</Card>}
        {plans?.map((plan) => <PlanRow key={`${plan.id}-${version}`} plan={plan} onSave={setPending} />)}
      </div>
      {pending && (
        <Dialog title="Confirm plan change" onClose={() => setPending(null)} testId="plan-confirm">
          <p className="text-sm text-muted-foreground">{pending.summary}</p>
          <p className="mt-2 text-xs text-muted-foreground">Orders already created keep the amount they were created with.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPending(null)} disabled={busy}>
              Back
            </Button>
            <Button type="button" size="sm" onClick={() => void confirm()} disabled={busy}>
              {busy ? 'Saving…' : 'Confirm'}
            </Button>
          </div>
        </Dialog>
      )}
    </AdminShell>
  );
}
