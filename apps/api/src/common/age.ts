export function calculateAge(dateOfBirth: Date): number {
  const now = new Date();
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const hasHadBirthdayThisYear =
    now.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (now.getUTCMonth() === dateOfBirth.getUTCMonth() && now.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}

// ageMin/ageMax arrive as whole years; converted to a dateOfBirth range since
// age itself isn't a stored column. ageMax=30 means "up to and including 30",
// so the lower dateOfBirth bound is exclusive of turning (ageMax + 1).
export function ageRangeToDobRange(ageMin?: number, ageMax?: number, now: Date = new Date()): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (ageMax !== undefined) {
    range.gte = new Date(Date.UTC(now.getUTCFullYear() - ageMax - 1, now.getUTCMonth(), now.getUTCDate() + 1));
  }
  if (ageMin !== undefined) {
    range.lte = new Date(Date.UTC(now.getUTCFullYear() - ageMin, now.getUTCMonth(), now.getUTCDate()));
  }
  return range;
}
