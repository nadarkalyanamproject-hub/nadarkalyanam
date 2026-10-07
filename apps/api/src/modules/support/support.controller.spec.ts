import { describe, expect, it } from 'vitest';
import { envSchema } from '../config/env.schema.js';
import { SupportController } from './support.controller.js';

const controller = (values: Record<string, string | undefined>) => new SupportController({ get: (key: string) => values[key] } as never);

describe('GET /support/contact', () => {
  it('returns only what is configured', () => {
    expect(
      controller({
        SUPPORT_EMAIL: 'help@example.org',
        SUPPORT_WHATSAPP_NUMBER: '919812345678',
      }).contact(),
    ).toEqual({
      email: 'help@example.org',
      whatsappNumber: '919812345678',
    });
    expect(controller({ SUPPORT_EMAIL: 'help@example.org' }).contact()).toEqual({ email: 'help@example.org', whatsappNumber: null });
  });

  it('returns nulls (nothing invented) when neither is set', () => {
    expect(controller({}).contact()).toEqual({
      email: null,
      whatsappNumber: null,
    });
  });
});

describe('support env vars', () => {
  const pick = (env: Record<string, string>) => envSchema.pick({ SUPPORT_EMAIL: true, SUPPORT_WHATSAPP_NUMBER: true }).safeParse(env);

  it('are optional, and blank counts as unset', () => {
    expect(pick({}).data).toEqual({});
    expect(pick({ SUPPORT_EMAIL: '', SUPPORT_WHATSAPP_NUMBER: '' }).data).toEqual({ SUPPORT_EMAIL: undefined, SUPPORT_WHATSAPP_NUMBER: undefined });
  });

  it('normalises the WhatsApp number to digits and rejects bad values', () => {
    expect(pick({ SUPPORT_WHATSAPP_NUMBER: '+91 98123-45678' }).data?.SUPPORT_WHATSAPP_NUMBER).toBe('919812345678');
    expect(pick({ SUPPORT_WHATSAPP_NUMBER: '12345' }).success).toBe(false);
    expect(pick({ SUPPORT_EMAIL: 'not-an-email' }).success).toBe(false);
  });
});
