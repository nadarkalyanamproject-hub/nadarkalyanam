'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { MyMembershipResponse } from '@nadar-kalyanam/schemas';
import { useRegistration } from '../../app/providers/registration-provider';
import { getMyMembership } from '../../lib/api-client';
import { formatPlanDate } from '../../lib/membership';

// Shown only on the member's OWN profile page. Other members never see
// anyone's plan (no plan name or premium badge in any public response).
export function MyPlanNote() {
  const { data } = useRegistration();
  const [me, setMe] = useState<MyMembershipResponse | null>(null);

  useEffect(() => {
    if (!data.accessToken) return;
    let cancelled = false;
    getMyMembership(data.accessToken)
      .then((result) => {
        if (!cancelled) setMe(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data.accessToken]);

  if (!me?.plan || !me.expiresAt) return null;
  return (
    <div className="rounded-xl border border-[#EADBBD] bg-[#FFFBF0] px-4 py-3 text-sm" data-testid="my-plan-note">
      <p className="text-[#2B1515]">
        Your plan: <span className="font-semibold">{me.plan.name}</span>, valid till {formatPlanDate(me.expiresAt)}.{' '}
        <Link href="/membership" className="text-xs font-semibold text-[#680A0E] underline">
          Details
        </Link>
      </p>
      {me.plan.searchTier > 0 && <p className="mt-0.5 text-xs text-[#5A493E]">Your profile appears higher in search.</p>}
      <p className="mt-0.5 text-[11px] text-[#8C7B73]">Only you can see this.</p>
    </div>
  );
}
