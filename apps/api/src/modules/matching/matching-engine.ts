import { calculateAge } from '../../common/age.js';
import type { Profile } from '../../generated/prisma/client.js';

type ProfileDetails = {
  maritalStatus?: string;
  religion?: string;
  casteCommunity?: string;
  location?: { city?: string; state?: string; country?: string };
};

// APPROVAL REQUIRED (SRS §4.3 / §8.4 "Profile completion formula" sibling
// decision — the matching score weights are equally unapproved). This is a
// placeholder rule-based scorer so FR-3.3/3.5/3.6 have a working, swappable
// implementation; Product must sign off on final weights before launch.
export const SCORING_CONFIG_VERSION = 'v0-placeholder';

// Stateless domain service (Fig 3 class diagram): pure functions over
// Profile data, never persisted itself.
export class MatchingEngine {
  static applyHardConstraints(viewer: Profile, candidate: Profile): boolean {
    if (candidate.visibility === 'HIDDEN') {
      return false;
    }
    return true;
  }

  static applySoftPreferences(viewer: Profile, candidate: Profile): number {
    const viewerDetails = (viewer.details as ProfileDetails) ?? {};
    const candidateDetails = (candidate.details as ProfileDetails) ?? {};
    let score = 0;

    const ageDiff = Math.abs(calculateAge(viewer.dateOfBirth) - calculateAge(candidate.dateOfBirth));
    score += Math.max(0, 20 - ageDiff * 2);

    if (viewerDetails.religion && viewerDetails.religion === candidateDetails.religion) {
      score += 25;
    }
    if (viewerDetails.casteCommunity && viewerDetails.casteCommunity === candidateDetails.casteCommunity) {
      score += 20;
    }
    if (viewerDetails.location?.city && viewerDetails.location.city === candidateDetails.location?.city) {
      score += 15;
    }
    if (candidateDetails.maritalStatus === 'NEVER_MARRIED') {
      score += 5;
    }
    if (candidate.isVerified) {
      score += 10;
    }
    score += Math.min(5, candidate.completionScore / 20);

    return score;
  }

  static computeScore(viewer: Profile, candidate: Profile): number {
    return this.applySoftPreferences(viewer, candidate);
  }

  static rankCandidates(viewer: Profile, candidates: Profile[]): Array<{ profile: Profile; score: number }> {
    return candidates
      .filter((candidate) => this.applyHardConstraints(viewer, candidate))
      .map((candidate) => ({ profile: candidate, score: this.computeScore(viewer, candidate) }))
      .sort((a, b) => b.score - a.score);
  }
}
