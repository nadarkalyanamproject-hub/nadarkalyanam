'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useRegistration } from '../../app/providers/registration-provider';
import { useIdentityStatus } from '../../lib/identity-status';

// Pages a signed-in member may open before passing DigiLocker.
const OPEN_PATHS = ['/verify-identity', '/contact'];

// Site-wide DigiLocker gate: a signed-in member whose account must verify is
// sent to /verify-identity from any other page, before anything else renders.
export function IdentityGate({ children }: { children: ReactNode }) {
  const { data, hydrated } = useRegistration();
  const pathname = usePathname();
  const router = useRouter();
  const token = data.accessToken;
  const open = OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const status = useIdentityStatus(open ? undefined : token);
  const mustVerify = Boolean(status?.required);

  useEffect(() => {
    if (mustVerify) router.replace('/verify-identity');
  }, [mustVerify, router]);

  if (!hydrated || open || !token) return <>{children}</>;
  // Hold the page until we know (one lookup per login), so a member who must
  // verify never sees the page flash first.
  if (status === undefined || mustVerify) return null;
  return <>{children}</>;
}
