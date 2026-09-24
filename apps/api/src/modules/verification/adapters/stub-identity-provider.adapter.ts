import { Injectable, NotImplementedException } from '@nestjs/common';
import type {
  IdentityConfirmResult,
  IdentityInitiateResult,
  IdentityProviderAdapter,
} from './identity-provider.adapter.js';

// No identity verification provider is contracted yet (SRS §2.6) — both
// operations are a hard stop until one is.
@Injectable()
export class StubIdentityProviderAdapter implements IdentityProviderAdapter {
  readonly isStub = true as const;

  initiate(): Promise<IdentityInitiateResult> {
    throw new NotImplementedException('No identity verification provider is configured yet');
  }

  confirmStatus(): Promise<IdentityConfirmResult> {
    throw new NotImplementedException('No identity verification provider is configured yet');
  }
}
