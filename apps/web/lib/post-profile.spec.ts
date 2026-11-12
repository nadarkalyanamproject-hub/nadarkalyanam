import { describe, expect, it } from 'vitest';
import {
  PHOTO_STEP_HREF,
  countActivePhotos,
  photoStepDecision,
  photoStepExit,
  wizardStepRedirect,
} from './post-profile';

describe('post-profile flow', () => {
  it('sends a new member from the success screen to the photos step', () => {
    expect(PHOTO_STEP_HREF).toBe('/onboarding/photo?welcome=1');
  });

  it('keeps a member who already has a profile out of the wizard (Back from photos)', () => {
    expect(wizardStepRedirect(true)).toBe('/');
    expect(wizardStepRedirect(false)).toBeNull();
    expect(wizardStepRedirect(undefined)).toBeNull();
  });

  it('leaves the photos step for plans after sign-up, home otherwise', () => {
    expect(photoStepExit(true)).toBe('/membership?welcome=1');
    expect(photoStepExit(false)).toBe('/');
  });

  it('shows the photos step to a new member with no photos (also after a reload)', () => {
    expect(photoStepDecision({ profile: 'found', activePhotoCount: 0, fromSignup: true })).toEqual({ action: 'show' });
  });

  it('does not force a member who already has a photo through it again', () => {
    expect(photoStepDecision({ profile: 'found', activePhotoCount: 1, fromSignup: false })).toEqual({ action: 'redirect', to: '/' });
    expect(photoStepDecision({ profile: 'found', activePhotoCount: 2, fromSignup: true })).toEqual({
      action: 'redirect',
      to: '/membership?welcome=1',
    });
  });

  it('sends a member without a profile to the wizard (a 404 means no profile)', () => {
    expect(photoStepDecision({ profile: 'missing', activePhotoCount: 0, fromSignup: true })).toEqual({
      action: 'redirect',
      to: '/onboarding/basic-details',
    });
  });

  it('shows the page when the profile check failed for another reason', () => {
    expect(photoStepDecision({ profile: 'unknown', activePhotoCount: 0, fromSignup: false })).toEqual({ action: 'show' });
  });

  it('ignores rejected photos when counting', () => {
    expect(countActivePhotos([{ status: 'REJECTED' }, { status: 'PENDING' }, { status: 'APPROVED' }])).toBe(2);
    expect(countActivePhotos([{ status: 'REJECTED' }])).toBe(0);
  });
});
