'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useRegistration } from '../app/providers/registration-provider';
import { consumeAuthRedirectClaim } from './auth-events';

export function useRequireAuth(): { ready: boolean } {
  const router = useRouter();
  const { data, hydrated } = useRegistration();

  useEffect(() => {
    // A 401 or a manual logout already navigates itself — don't also
    // bounce to / for the same accessToken-becomes-undefined change.
    if (consumeAuthRedirectClaim()) return;
    if (hydrated && !data.accessToken) {
      // Register/Login are both homepage modals now — there's no
      // standalone /register route to send an unauthenticated visitor to.
      router.replace('/');
    }
  }, [hydrated, data.accessToken, router]);

  return { ready: hydrated && Boolean(data.accessToken) };
}
