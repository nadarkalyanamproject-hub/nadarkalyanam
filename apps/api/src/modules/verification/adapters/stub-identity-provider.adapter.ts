import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  IdentityConfirmResult,
  IdentityInitiateResult,
  IdentityProviderAdapter,
} from './identity-provider.adapter.js';

// No DigiLocker provider is contracted yet (SRS §2.6). For local development
// this stand-in skips DigiLocker: it sends the member straight back to the
// web app's callback page and confirms with a fixed test identity.
// VerificationService refuses it in production (assertProviderConfigured).
@Injectable()
export class StubIdentityProviderAdapter implements IdentityProviderAdapter {
  readonly isStub = true as const;

  initiate(): Promise<IdentityInitiateResult> {
    const providerReference = `stub-${randomUUID()}`;
    return Promise.resolve({ redirectUrl: `/verify-identity/callback?reference=${providerReference}`, providerReference });
  }

  confirmStatus(providerReference: string): Promise<IdentityConfirmResult> {
    if (!providerReference.startsWith('stub-')) return Promise.resolve({ succeeded: false });
    return Promise.resolve({ succeeded: true, identity: { name: 'Test Member', dateOfBirth: '1996-05-15' } });
  }
}
