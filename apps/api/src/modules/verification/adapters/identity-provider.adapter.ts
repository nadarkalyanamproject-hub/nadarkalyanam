export const IDENTITY_PROVIDER_ADAPTER = Symbol('IDENTITY_PROVIDER_ADAPTER');

export interface IdentityInitiateResult {
  redirectUrl: string;
  providerReference: string;
}

export interface IdentityConfirmResult {
  succeeded: boolean;
}

// FR-8.1/8.2: consent-based document flow with a DigiLocker/KYC-style
// provider (SRS §2.6). The result of initiate() is never trusted on its own
// — confirmStatus() is a server-to-server call, independent of the client
// redirect, per Figure 7.
export interface IdentityProviderAdapter {
  initiate(userId: string): Promise<IdentityInitiateResult>;
  confirmStatus(providerReference: string): Promise<IdentityConfirmResult>;
}
