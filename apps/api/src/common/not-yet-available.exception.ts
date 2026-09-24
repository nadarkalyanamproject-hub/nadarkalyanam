import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../modules/config/env.schema.js';

// Marker interface a stub provider adapter implements (real adapters never
// set this — see StubPaymentGatewayAdapter/StubRtcProviderAdapter/
// StubIdentityProviderAdapter). Structural, not a base class, so it costs a
// real adapter nothing to simply not implement it.
export interface StubProviderAdapter {
  readonly isStub: true;
}

export class NotYetAvailableException extends ServiceUnavailableException {
  constructor(feature: string) {
    super(`${feature} is not yet available. Please check back soon.`);
  }
}

// Shared gate for payments/calls/verification: in production, a stub
// provider adapter must never be allowed to produce a fake-success result
// (or, for payments specifically, a real DB row with no real provider order
// behind it). Outside production, the stub's own behavior is left
// unchanged — that's what local dev exercises against.
export function assertProviderConfigured(
  configService: ConfigService<Env, true>,
  adapter: unknown,
  feature: string,
): void {
  const isProduction = configService.get('NODE_ENV', { infer: true }) === 'production';
  const isStub = (adapter as Partial<StubProviderAdapter> | null)?.isStub === true;
  if (isProduction && isStub) {
    throw new NotYetAvailableException(feature);
  }
}
