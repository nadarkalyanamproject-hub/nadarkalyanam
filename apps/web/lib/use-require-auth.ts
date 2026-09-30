'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRegistration } from '../app/providers/registration-provider';
import { ApiError, getMyProfile } from './api-client';
import { consumeAuthRedirectClaim } from './auth-events';

export function useRequireAuth(): { ready: boolean } {
  const router = useRouter();
  const pathname = usePathname();
  const { data, hydrated, markProfileCreated } = useRegistration();

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

  // A signed-in user who hasn't created a profile yet belongs in onboarding:
  // every other authenticated page is about *their* profile, and has nothing
  // real to show them (browser Back out of step 1 used to land on the home
  // dashboard). The cached hasProfile flag is only a hint — it's confirmed
  // against the server before redirecting, so a profile finished on another
  // device isn't sent back through the wizard.
  const needsProfileCheck =
    hydrated && Boolean(data.accessToken) && data.hasProfile === false && !pathname.startsWith('/onboarding');
  // A non-404 failure (network, 5xx) shows the page rather than a blank
  // screen; the page's own fetches then surface the error.
  const [profileCheckFailed, setProfileCheckFailed] = useState(false);

  useEffect(() => {
    if (!needsProfileCheck || !data.accessToken) return;
    let cancelled = false;
    getMyProfile(data.accessToken)
      .then(() => {
        if (!cancelled) markProfileCreated();
      })
      .catch((error: unknown) => {
        // A 401 is handled by the provider (claim + clearAuth + push to /).
        if (cancelled || consumeAuthRedirectClaim()) return;
        if (error instanceof ApiError && error.status === 404) router.replace('/onboarding/basic-details');
        else setProfileCheckFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [needsProfileCheck, data.accessToken, markProfileCreated, router]);

  return { ready: hydrated && Boolean(data.accessToken) && (!needsProfileCheck || profileCheckFailed) };
}
