export const RTC_PROVIDER_ADAPTER = Symbol('RTC_PROVIDER_ADAPTER');

// FR-6.2: the backend never relays call media itself — it only creates a
// room and issues short-lived, room-scoped tokens via this adapter (SFU
// provider, per SRS §2.6).
export interface RtcProviderAdapter {
  createRoom(): Promise<{ roomId: string }>;
  issueToken(roomId: string, participantUserId: string): Promise<{ token: string }>;
  // Set (to `true`) only by the stub implementation — see
  // common/not-yet-available.exception.ts.
  readonly isStub?: boolean;
}
