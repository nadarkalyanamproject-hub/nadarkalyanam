'use client';

import { useCallback, useEffect, useState } from 'react';
import { updatePlanRequestSchema, type UpdatePlanRequest } from '@nadar-kalyanam/schemas';
import { Button, Card, Input } from '@nadar-kalyanam/ui';
import { AdminShell } from '../../components/admin-shell';
import { Dialog } from '../../components/billing-ui';
import { ApiError } from '../../lib/api-client';
import { listPlans, rupees, updatePlan, type AdminPlan } from '../../lib/billing-api';
import { useRequireAdminAuth } from '../../lib/use-require-admin-auth';
import { useAdminAuth } from '../providers/admin-auth-provider';

type Pending = {
  plan: AdminPlan;
  change: UpdatePlanRequest;
  summary: string[];
};
type FeatureLine = {
  id: number;
  key?: string;
  label: string;
  available: boolean;
};

let lineSeq = 0;
const toLines = (plan: AdminPlan): FeatureLine[] =>
  plan.features.map((f) => ({
    id: (lineSeq += 1),
    key: f.key,
    label: f.label,
    available: f.available,
  }));
const sameFeatures = (a: FeatureLine[], plan: AdminPlan) =>
  a.length === plan.features.length &&
  a.every((l, i) => l.key === plan.features[i]!.key && l.label.trim() === plan.features[i]!.label && l.available === plan.features[i]!.available);

// The edit form for one plan. Duration, phone-unlock limit, listing tier and
// "assisted" are shown read-only: members' active subscriptions read them
// from the plan, so changing them would change what they already hold.
function PlanEditor({ plan, onSave, onCancel }: { plan: AdminPlan; onSave: (p: Pending) => void; onCancel: () => void }) {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? '');
  const [price, setPrice] = useState(String(plan.priceInPaise / 100));
  const [sortOrder, setSortOrder] = useState(String(plan.sortOrder));
  const [lines, setLines] = useState<FeatureLine[]>(() => toLines(plan));
  const [errors, setErrors] = useState<string[]>([]);

  const setLine = (id: number, patch: Partial<FeatureLine>) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const move = (index: number, by: -1 | 1) =>
    setLines((ls) => {
      const next = [...ls];
      const [line] = next.splice(index, 1);
      next.splice(index + by, 0, line!);
      return next;
    });

  function review() {
    const change: UpdatePlanRequest = {};
    const summary: string[] = [];
    if (name.trim() !== plan.name) {
      change.name = name.trim();
      summary.push(`Name: "${plan.name}" → "${name.trim()}"`);
    }
    if (description.trim() !== (plan.description ?? '')) {
      change.description = description.trim() || null;
      summary.push(description.trim() ? `Description → "${description.trim()}"` : 'Description removed');
    }
    const priceInPaise = Math.round(Number(price) * 100);
    if (priceInPaise !== plan.priceInPaise) {
      change.priceInPaise = priceInPaise;
      summary.push(`Price: ${rupees(plan.priceInPaise)} → ${Number.isFinite(priceInPaise) ? rupees(priceInPaise) : price} (new orders only)`);
    }
    if (Number(sortOrder) !== plan.sortOrder) {
      change.sortOrder = Number(sortOrder);
      summary.push(`Display order: ${plan.sortOrder} → ${sortOrder}`);
    }
    if (!sameFeatures(lines, plan)) {
      change.features = lines.map((l) => ({
        ...(l.key ? { key: l.key } : {}),
        label: l.label,
        available: l.available,
      }));
      summary.push(`Feature list: ${plan.features.length} → ${lines.length} lines`);
    }
    if (summary.length === 0) {
      setErrors(['Nothing has changed.']);
      return;
    }
    const parsed = updatePlanRequestSchema.safeParse(change);
    if (!parsed.success) {
      setErrors([...new Set(parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(' ')}: ${i.message}` : i.message)))]);
      return;
    }
    setErrors([]);
    onSave({ plan, change: parsed.data, summary });
  }

  return (
    <div className="mt-4 border-t border-border pt-4" data-testid="plan-editor">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">
          Display name
          <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label={`${plan.code} name`} />
        </label>
        <label className="text-xs text-muted-foreground">
          Price (₹, incl. taxes)
          <Input type="number" min={1} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} aria-label={`${plan.code} price`} />
        </label>
        <label className="text-xs text-muted-foreground">
          Display order
          <Input
            type="number"
            min={0}
            max={1000}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            aria-label={`${plan.code} order`}
          />
        </label>
      </div>
      <label className="mt-3 block text-xs text-muted-foreground">
        Short description (optional, shown on the plan card)
        <Input value={description} maxLength={160} onChange={(e) => setDescription(e.target.value)} aria-label={`${plan.code} description`} />
      </label>

      <p className="mt-4 text-xs font-semibold text-muted-foreground">Feature list (as members see it)</p>
      <ul className="mt-1 space-y-2">
        {lines.map((line, i) => (
          <li key={line.id} className="flex flex-wrap items-center gap-2" data-testid="feature-line">
            <Input
              className="min-w-0 flex-1"
              value={line.label}
              maxLength={120}
              onChange={(e) => setLine(line.id, { label: e.target.value })}
              aria-label={`Feature ${i + 1} text`}
            />
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={line.available} onChange={(e) => setLine(line.id, { available: e.target.checked })} />
              Available now
            </label>
            <Button type="button" size="sm" variant="outline" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move feature ${i + 1} up`}>
              ↑
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={i === lines.length - 1}
              onClick={() => move(i, 1)}
              aria-label={`Move feature ${i + 1} down`}
            >
              ↓
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setLines((ls) => ls.filter((l) => l.id !== line.id))}
              aria-label={`Remove feature ${i + 1}`}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2"
        disabled={lines.length >= 15}
        onClick={() => setLines((ls) => [...ls, { id: (lineSeq += 1), label: '', available: false }])}
      >
        Add feature line
      </Button>
      <p className="mt-1 text-xs text-muted-foreground">
        Unticked lines show as Coming Soon. This is display text only — it does not switch features on or off.
      </p>

      <div className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground" data-testid="plan-readonly">
        <p className="font-semibold text-foreground">Fixed for this plan</p>
        <p className="mt-1">
          Code {plan.code} · {plan.durationDays} days · phone unlocks {plan.phoneUnlockLimit ?? 'unlimited'} ·{' '}
          {plan.isAssisted ? 'assisted' : 'self-serve'} · search listing tier (set by plan code)
        </p>
        <p className="mt-1">
          These can&apos;t be edited here: members&apos; current subscriptions read them from the plan, so a change would alter what they already paid
          for. To offer different terms, a new plan has to be created by a developer.
        </p>
      </div>

      {errors.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-destructive" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={review} data-testid="plan-review">
          Review changes
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function PlanRow({ plan, onSave }: { plan: AdminPlan; onSave: (p: Pending) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <Card className="rounded-2xl p-5 shadow-sm" data-testid="plan-row" data-plan-code={plan.code}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{plan.code}</p>
          <p className="text-base font-semibold text-foreground">
            {plan.name} · {rupees(plan.priceInPaise)}
          </p>
          {plan.description && <p className="text-sm text-muted-foreground">{plan.description}</p>}
          <p className="text-sm text-muted-foreground">
            {plan.durationDays} days · phone unlocks {plan.phoneUnlockLimit ?? 'unlimited'}
            {plan.isAssisted ? ' · assisted' : ''} · order {plan.sortOrder} · {plan.activeSubscriptions} active
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${plan.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}
        >
          {plan.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>
      {!editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => setEditing(true)} data-testid="plan-edit">
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onSave({
                plan,
                change: { isActive: !plan.isActive },
                summary: [
                  plan.isActive
                    ? `Deactivate ${plan.name}? It disappears from the member Membership page, can't be ordered and can't be granted. Existing subscriptions keep working until they end.`
                    : `Activate ${plan.name}? Members will see it on the Membership page again, and it can be granted.`,
                ],
              })
            }
          >
            {plan.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      )}
      {editing && <PlanEditor plan={plan} onSave={onSave} onCancel={() => setEditing(false)} />}
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
      setMessage(`${pending.plan.name} saved. Members see the change on the Membership page now.`);
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
            Edit a plan&apos;s name, description, feature list, price, display order and whether it&apos;s offered. Price applies to new orders only.
            Duration, phone-unlock limit and tier are fixed so existing members keep exactly what they hold.
          </p>
        </div>
        {message && (
          <Card className="rounded-2xl p-4 text-sm text-muted-foreground" role="status">
            {message}
          </Card>
        )}
        {error && (
          <Card className="rounded-2xl p-4 text-sm text-destructive" role="alert">
            {error}
          </Card>
        )}
        {!plans && !error && <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Loading…</Card>}
        {plans?.map((plan) => (
          <PlanRow key={`${plan.id}-${version}`} plan={plan} onSave={setPending} />
        ))}
      </div>
      {pending && (
        <Dialog title="Confirm plan change" onClose={() => setPending(null)} testId="plan-confirm">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {pending.summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Existing subscriptions and orders are not changed.</p>
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
