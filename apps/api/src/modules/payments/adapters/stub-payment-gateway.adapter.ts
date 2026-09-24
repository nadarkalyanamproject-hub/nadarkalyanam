import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import type { PaymentGatewayAdapter, ProviderOrder } from './payment-gateway.adapter.js';

// No payment gateway is contracted yet (SRS §2.6). createProviderOrder is a
// hard stop until one is — but verifyWebhookSignature is real, provider-
// agnostic HMAC-SHA256 verification, so FR-7.3's signature check can be
// implemented and tested against today, ahead of the real integration.
@Injectable()
export class StubPaymentGatewayAdapter implements PaymentGatewayAdapter {
  constructor(private readonly configService: ConfigService<Env, true>) {}

  createProviderOrder(): Promise<ProviderOrder> {
    throw new NotImplementedException('No payment gateway is configured yet');
  }

  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
    if (!signature) {
      return false;
    }
    const secret = this.configService.get('PAYMENT_WEBHOOK_SECRET', { infer: true });
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(signature, 'hex');
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }
}
