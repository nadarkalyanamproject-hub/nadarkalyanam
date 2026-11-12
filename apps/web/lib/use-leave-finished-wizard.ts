'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRegistration } from '../app/providers/registration-provider';
import { consumeAuthRedirectClaim } from './auth-events';
import { wizardStepRedirect } from './post-profile';

/**
 * For wizard steps 1-3: a member who already has a profile (browser Back from
 * the Add Photos screen, an old tab, Finish in another tab) is sent home
 * instead of seeing the wizard again with an empty draft. Returns true while
 * leaving, so the step renders nothing meanwhile.
 *
 * Step 4 keeps its own guard: it sets hasProfile itself on Finish and must
 * skip this redirect while it navigates to the success screen.
 */
export function useLeaveFinishedWizard(ready: boolean): boolean {
  const router = useRouter();
  const { data } = useRegistration();
  const to = ready ? wizardStepRedirect(data.hasProfile) : null;

  useEffect(() => {
    // A 401/logout already navigates itself for the same state change.
    if (!to || consumeAuthRedirectClaim()) return;
    router.replace(to);
  }, [to, router]);

  return to !== null;
}
