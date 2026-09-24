import { Injectable, Logger } from '@nestjs/common';
import type { NotificationChannelAdapter } from './notification-channel.adapter.js';

// Every real channel (push, SMS, email — SRS §2.6) is unconfigured for now.
// Unlike the payment/identity/RTC adapters, a missing notification channel
// must not break the primary flow it was decoupled from (FR-10.5) — so this
// logs and resolves instead of throwing.
@Injectable()
export class LogChannelAdapter implements NotificationChannelAdapter {
  private readonly logger = new Logger(LogChannelAdapter.name);

  constructor(private readonly channelName: string) {}

  async send(userId: string, type: string, payload: Record<string, unknown>): Promise<void> {
    this.logger.log(`[${this.channelName}] would notify user=${userId} type=${type} payload=${JSON.stringify(payload)}`);
  }
}
