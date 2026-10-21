export const IDENTITY_PROVIDER_ADAPTER = Symbol('IDENTITY_PROVIDER_ADAPTER');

export interface IdentityInitiateResult {
  // Where the member goes to give DigiLocker consent. The provider sends
  // them back to the web app's /verify-identity/callback?reference=...
  redirectUrl: string;
  providerReference: string;
}

// What the ID says. Only these are kept (users.identityName/DateOfBirth):
// never the Aadhaar number or the document itself.
export interface VerifiedIdentity {
  name: string;
  // YYYY-MM-DD
  dateOfBirth: string;
}

export interface IdentityConfirmResult {
  succeeded: boolean;
  // Present when succeeded.
  identity?: VerifiedIdentity;
}

// FR-8.1/8.2: consent-based document flow with a DigiLocker/KYC-style
// provider (SRS §2.6). The result of initiate() is never trusted on its own
// — confirmStatus() is a server-to-server call, independent of the client
// redirect, per Figure 7.
export interface IdentityProviderAdapter {
  initiate(userId: string): Promise<IdentityInitiateResult>;
  confirmStatus(providerReference: string): Promise<IdentityConfirmResult>;
  // Set (to `true`) only by the stub implementation — see
  // common/not-yet-available.exception.ts.
  readonly isStub?: boolean;
}
