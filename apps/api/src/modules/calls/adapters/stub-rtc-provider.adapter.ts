import { Injectable, NotImplementedException } from '@nestjs/common';
import type { RtcProviderAdapter } from './rtc-provider.adapter.js';

// No RTC/SFU provider is contracted yet (SRS §2.6) — both operations are a
// hard stop until one is.
@Injectable()
export class StubRtcProviderAdapter implements RtcProviderAdapter {
  createRoom(): Promise<{ roomId: string }> {
    throw new NotImplementedException('No RTC/SFU provider is configured yet');
  }

  issueToken(): Promise<{ token: string }> {
    throw new NotImplementedException('No RTC/SFU provider is configured yet');
  }
}
