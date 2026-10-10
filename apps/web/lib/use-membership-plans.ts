'use client';

import { useEffect, useState } from 'react';
import type { MembershipPlanResponse } from '@nadar-kalyanam/schemas';
import { listMembershipPlans } from './api-client';

// Active plans (GET /membership-plans, public), sorted for display. One
// request per page load, shared by every component that asks; null while
// loading or if it failed (callers then show copy without a price).
let request: Promise<MembershipPlanResponse[]> | null = null;

function loadPlans(): Promise<MembershipPlanResponse[]> {
  request ??= listMembershipPlans()
    .then((r) => [...r.items].sort((a, b) => a.sortOrder - b.sortOrder))
    .catch((err: unknown) => {
      request = null;
      throw err;
    });
  return request;
}

export function useMembershipPlans(): MembershipPlanResponse[] | null {
  const [plans, setPlans] = useState<MembershipPlanResponse[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadPlans()
      .then((p) => {
        if (!cancelled) setPlans(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return plans;
}
