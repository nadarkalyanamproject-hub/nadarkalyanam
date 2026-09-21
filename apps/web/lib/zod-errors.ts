import type { z } from 'zod';

export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0]?.toString() ?? '_root';
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
