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

export function getStepCompletionCounts(
  schema: IntrospectableSchema,
  values: Record<string, unknown>,
  excludeKeys: string[] = [],
): StepCompletionCounts {
  const requiredKeys = Object.keys(schema.shape).filter(
    (key) => !schema.shape[key].isOptional() && !excludeKeys.includes(key),
  );

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
