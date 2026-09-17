import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

describe('validateEnv', () => {
  it('applies defaults for optional fields', () => {
    const env = validateEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost:5439/db',
      REDIS_URL: 'redis://localhost:6380',
    });

    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('throws when a required field is missing', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });
});
