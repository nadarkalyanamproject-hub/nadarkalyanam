import type { PrismaService } from '../modules/prisma/prisma.service.js';

// Profile completion = filled fields / COMPLETION_FIELDS.length, as a whole
// percentage. Every field below counts equally: the 20 profile fields the
// onboarding wizard collects plus having at least one photo (21 in total).
// A field is "filled" when it holds a non-blank value. Follow-up details that
// only apply conditionally (previous marriage details, dosham details) are
// not counted, so nobody is marked down for a question that doesn't apply.
// Nothing the member can't currently enter (horoscope, partner preferences,
// lifestyle) is counted either.

export interface CompletionInput {
  fullName?: string | null;
  gender?: string | null;
  dateOfBirth?: Date | string | null;
  details?: unknown;
}

type Details = {
  motherTongue?: unknown;
  email?: unknown;
  height?: unknown;
  physicalStatus?: unknown;
  maritalStatus?: unknown;
  religion?: unknown;
  casteCommunity?: unknown;
  dosham?: unknown;
  location?: { city?: unknown; state?: unknown };
  education?: {
    educationLevel?: unknown;
    educationDetail?: unknown;
    profession?: unknown;
    employedIn?: unknown;
    annualIncomeRange?: unknown;
  };
  additional?: { familyType?: unknown; about?: unknown };
};

export const COMPLETION_FIELDS: readonly { key: string; value: (p: CompletionInput, d: Details, photos: number) => unknown }[] = [
  { key: 'fullName', value: (p) => p.fullName },
  { key: 'gender', value: (p) => p.gender },
  { key: 'dateOfBirth', value: (p) => p.dateOfBirth },
  { key: 'motherTongue', value: (_, d) => d.motherTongue },
  { key: 'email', value: (_, d) => d.email },
  { key: 'height', value: (_, d) => d.height },
  { key: 'physicalStatus', value: (_, d) => d.physicalStatus },
  { key: 'maritalStatus', value: (_, d) => d.maritalStatus },
  { key: 'religion', value: (_, d) => d.religion },
  { key: 'casteCommunity', value: (_, d) => d.casteCommunity },
  { key: 'dosham', value: (_, d) => d.dosham },
  { key: 'city', value: (_, d) => d.location?.city },
  { key: 'state', value: (_, d) => d.location?.state },
  { key: 'educationLevel', value: (_, d) => d.education?.educationLevel },
  { key: 'educationDetail', value: (_, d) => d.education?.educationDetail },
  { key: 'profession', value: (_, d) => d.education?.profession },
  { key: 'employedIn', value: (_, d) => d.education?.employedIn },
  { key: 'annualIncomeRange', value: (_, d) => d.education?.annualIncomeRange },
  { key: 'familyType', value: (_, d) => d.additional?.familyType },
  { key: 'about', value: (_, d) => d.additional?.about },
  { key: 'photo', value: (_, __, photos) => photos > 0 },
];

function isFilled(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'string') return value.trim() !== '';
  return value === true;
}

export function missingCompletionFields(profile: CompletionInput, photoCount: number): string[] {
  const details = (profile.details ?? {}) as Details;
  return COMPLETION_FIELDS.filter((field) => !isFilled(field.value(profile, details, photoCount))).map((f) => f.key);
}

export function computeCompletionScore(profile: CompletionInput, photoCount: number): number {
  const filled = COMPLETION_FIELDS.length - missingCompletionFields(profile, photoCount).length;
  return Math.round((filled / COMPLETION_FIELDS.length) * 100);
}

// Recomputes and stores one profile's score from its current row and photo
// count. Called after anything that changes a counted field (profile create/
// edit, photo add/delete); returns the new score.
export async function refreshCompletionScore(prisma: PrismaService, profileId: string): Promise<number> {
  const [profile, photoCount] = await Promise.all([
    prisma.profile.findUnique({ where: { id: profileId } }),
    prisma.profilePhoto.count({ where: { profileId } }),
  ]);
  if (!profile) return 0;
  const completionScore = computeCompletionScore(profile, photoCount);
  if (completionScore !== profile.completionScore) {
    await prisma.profile.update({ where: { id: profileId }, data: { completionScore } });
  }
  return completionScore;
}
