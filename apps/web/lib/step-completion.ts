interface IntrospectableField {
  isOptional(): boolean;
}

interface IntrospectableSchema {
  shape: Record<string, IntrospectableField>;
}

function isFilled(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}

export interface StepCompletionCounts {
  filled: number;
  total: number;
}

// The schema's required keys (not optional/defaulted), minus any excluded
// ones. Shared by the progress calculation below and the required-field
// markers (lib/required-fields.ts), so the two can never disagree.
export function getRequiredKeys(schema: IntrospectableSchema, excludeKeys: string[] = []): string[] {
  return Object.keys(schema.shape).filter((key) => !schema.shape[key].isOptional() && !excludeKeys.includes(key));
}

export function getStepCompletionCounts(
  schema: IntrospectableSchema,
  values: Record<string, unknown>,
  excludeKeys: string[] = [],
): StepCompletionCounts {
  const requiredKeys = getRequiredKeys(schema, excludeKeys);

  const filled = requiredKeys.filter((key) => isFilled(values[key])).length;
  return { filled, total: requiredKeys.length };
}

export function getStepCompletionPercent(
  schema: IntrospectableSchema,
  values: Record<string, unknown>,
  excludeKeys: string[] = [],
): number {
  const { filled, total } = getStepCompletionCounts(schema, values, excludeKeys);
  if (total === 0) return 0;
  return Math.round((filled / total) * 100);
}
