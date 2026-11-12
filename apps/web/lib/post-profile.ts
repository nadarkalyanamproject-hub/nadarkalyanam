// Where a member goes around the "Add Profile Photos" step that follows
// profile creation: Finish -> /onboarding/success -> /onboarding/photo ->
// /membership?welcome=1. Pure so the decisions are unit tested.

/** The success screen sends new members here; `welcome=1` marks "just signed up". */
export const PHOTO_STEP_HREF = '/onboarding/photo?welcome=1';

/**
 * A wizard step opened by a member who already has a profile (browser Back
 * from the photos screen, an old tab, a bookmark) must not reopen the wizard
 * with an empty draft: send them home, like Finish in another tab does.
 */
export function wizardStepRedirect(hasProfile: boolean | undefined): string | null {
  return hasProfile ? '/' : null;
}

/** Where "Do it later" and a finished upload lead. */
export function photoStepExit(fromSignup: boolean): string {
  return fromSignup ? '/membership?welcome=1' : '/';
}

/** Photos that still count: pending review or approved (not rejected). */
export function countActivePhotos(photos: readonly { status: string }[]): number {
  return photos.filter((p) => p.status !== 'REJECTED').length;
}

export type PhotoStepDecision = { action: 'show' } | { action: 'redirect'; to: string };

/**
 * What the photos screen does once the member's profile has been checked:
 * - no profile yet (404): photos need a profile, so go to the wizard;
 * - already has a photo: nothing to do here, move on;
 * - otherwise (including a failed check, so a network blip never blanks
 *   the page) show the upload screen.
 */
export function photoStepDecision(input: {
  profile: 'found' | 'missing' | 'unknown';
  activePhotoCount: number;
  fromSignup: boolean;
}): PhotoStepDecision {
  if (input.profile === 'missing') return { action: 'redirect', to: '/onboarding/basic-details' };
  if (input.profile === 'found' && input.activePhotoCount > 0) {
    return { action: 'redirect', to: photoStepExit(input.fromSignup) };
  }
  return { action: 'show' };
}
