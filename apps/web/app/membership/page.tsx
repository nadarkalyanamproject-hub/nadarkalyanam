'use client';

import { useEffect, useState, type SVGProps } from 'react';
import type { MembershipPlanResponse, OrderResponse } from '@nadar-kalyanam/schemas';
import { Button, Card } from '@nadar-kalyanam/ui';
import { AppHeader } from '../../components/app-header';
import { ApiError, createOrder, listMembershipPlans } from '../../lib/api-client';
import { useRegistration } from '../providers/registration-provider';
import { useRequireAuth } from '../../lib/use-require-auth';

function formatPrice(priceInPaise: number): string {
  return `₹${(priceInPaise / 100).toLocaleString('en-IN')}`;
}

function formatEntitlementLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function MembershipPage() {
  const { ready } = useRequireAuth();
  const { data } = useRegistration();
  const [plans, setPlans] = useState<MembershipPlanResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderingPlanId, setOrderingPlanId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    listMembershipPlans()
      .then((result) => setPlans(result.items))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Could not load membership plans.');
      });
  }, []);

  async function handleChoosePlan(planId: string) {
    if (!data.accessToken) return;
    setOrderingPlanId(planId);
    setOrderError(null);
    setOrder(null);
    try {
      const created = await createOrder(data.accessToken, { planId });
      setOrder(created);
    } catch (err) {
      setOrderError(err instanceof ApiError ? err.message : 'Could not create your order. Please try again.');
    } finally {
      setOrderingPlanId(null);
    }
  }

  if (!ready) return null;

  return (
    <>
      <AppHeader />
      <main className="min-h-screen bg-secondary px-4 py-12">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Membership</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a plan to unlock additional interests and features.
            </p>
          </div>

          {!plans && !error && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Loading plans…
            </Card>
          )}

          {error && <Card className="rounded-2xl p-8 text-center text-sm text-destructive">{error}</Card>}

          {plans && plans.length === 0 && (
            <Card className="rounded-2xl p-8 text-center text-sm text-muted-foreground">
              No membership plans are available yet.
            </Card>
          )}

          {plans && plans.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const entitlementEntries = Object.entries(plan.entitlements).filter(
                  ([, value]) => value !== false && value !== null && value !== undefined,
                );
                return (
                  <Card
                    key={plan.id}
                    className="flex flex-col rounded-2xl p-6 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <h2 className="text-lg font-bold text-foreground">{plan.name}</h2>
                    <p className="mt-2 text-3xl font-bold text-primary">{formatPrice(plan.priceInPaise)}</p>
                    <p className="text-xs text-muted-foreground">for {plan.durationDays} days</p>

                    {entitlementEntries.length > 0 && (
                      <ul className="mt-5 flex flex-1 flex-col gap-2 border-t border-border pt-5">
                        {entitlementEntries.map(([key, value]) => (
                          <li key={key} className="flex items-start gap-2 text-sm text-foreground">
                            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                            <span>
                              {formatEntitlementLabel(key)}
                              {typeof value === 'number' || (typeof value === 'string' && value !== 'true')
                                ? `: ${value}`
                                : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <Button
                      type="button"
                      className="mt-6"
                      disabled={orderingPlanId === plan.id}
                      onClick={() => void handleChoosePlan(plan.id)}
                    >
                      {orderingPlanId === plan.id ? 'Creating order…' : 'Choose plan'}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}

          {orderError && (
            <Card className="rounded-2xl p-6 text-sm text-destructive">{orderError}</Card>
          )}

          {order && (
            <Card className="rounded-2xl border-accent/60 bg-accent/10 p-6 text-sm">
              <p className="font-semibold text-foreground">
                Order created — {formatPrice(order.amountInPaise)}, status: {order.status}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Checkout isn&apos;t connected to a live payment gateway yet, so this order will stay
                pending — nothing has been charged.
              </p>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
