import type { Lifestyle } from '@nadar-kalyanam/schemas';

// True once the member has answered at least one Lifestyle & Habits question.
export function hasLifestyle(lifestyle: Lifestyle | null | undefined): boolean {
  if (!lifestyle) return false;
  return Boolean(lifestyle.diet || lifestyle.smoking || lifestyle.drinking || lifestyle.hobbies?.length);
}
