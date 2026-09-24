export interface OffsetLimit {
  offset: number;
  limit: number;
}

export function parseOffsetLimit(
  offsetParam: string | undefined,
  limitParam: string | undefined,
  maxLimit = 100,
): OffsetLimit {
  const offset = Math.max(0, Number.parseInt(offsetParam ?? '0', 10) || 0);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(limitParam ?? String(maxLimit), 10) || maxLimit));
  return { offset, limit };
}
