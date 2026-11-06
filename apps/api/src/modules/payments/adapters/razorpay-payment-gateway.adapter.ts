import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadGatewayException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import type { PaymentGatewayAdapter, PaymentWebhookEvent, ProviderOrder, ProviderRefund } from './payment-gateway.adapter.js';

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

interface RazorpayPaymentEntity {
  id: string;
  order_id?: string;
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, string>;
}

interface RazorpayRefundEntity {
  id: string;
  payment_id: string;
  amount: number;
  currency?: string;
  status: string;
  notes?: Record<string, string>;
}

interface RazorpayWebhookPayload {
  id?: string;
  entity?: string;
  event?: string;
  contains?: string[];
  payload?: {
    payment?: { entity: RazorpayPaymentEntity };
    refund?: { entity: RazorpayRefundEntity };
  };
}

@Injectable()
export class RazorpayPaymentGatewayAdapter implements PaymentGatewayAdapter {
  readonly isStub = false as const;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(configService: ConfigService<Env, true>) {
    const keyId = configService.get('RAZORPAY_KEY_ID', { infer: true });
    const keySecret = configService.get('RAZORPAY_KEY_SECRET', { infer: true });
    if (!keyId || !keySecret) {
      throw new InternalServerErrorException('Razorpay credentials are not configured');
    }
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret =
      configService.get('RAZORPAY_WEBHOOK_SECRET', { infer: true }) ||
      configService.get('PAYMENT_WEBHOOK_SECRET', { infer: true });
  }

  async createProviderOrder(orderId: string, amountInPaise: number): Promise<ProviderOrder> {
    const credentials = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    let response: Response;
    try {
      response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: orderId.slice(0, 40),
          notes: { orderId },
        }),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error';
      throw new BadGatewayException(`Failed to connect to Razorpay: ${message}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadGatewayException(`Razorpay order creation failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as { id: string };
    if (!data.id) {
      throw new BadGatewayException('Razorpay order response missing id');
    }

    return {
      providerOrderId: data.id,
      checkoutParams: {
        key: this.keyId,
        amount: amountInPaise,
        currency: 'INR',
        name: 'Nadar Kalyanam',
        description: 'Membership Subscription',
        order_id: data.id,
        theme: {
          color: '#680A0E',
        },
      },
    };
  }

  async refund(
    paymentId: string,
    amountInPaise: number,
    reason?: string,
    orderId?: string,
  ): Promise<ProviderRefund> {
    const credentials = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    let response: Response;
    try {
      response = await fetch(`${RAZORPAY_API_BASE}/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          notes: {
            ...(reason ? { reason } : {}),
            ...(orderId ? { orderId } : {}),
          },
        }),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error';
      throw new BadGatewayException(`Failed to connect to Razorpay: ${message}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorDescription: string | undefined;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { description?: string } };
        errorDescription = errorJson.error?.description;
      } catch {
        // use raw errorText
      }
      throw new BadGatewayException(`Razorpay refund failed: ${response.status} ${errorDescription || errorText}`);
    }

    const data = (await response.json()) as {
      id: string;
      payment_id?: string;
      amount: number;
      status: string;
    };

    if (!data.id) {
      throw new BadGatewayException('Razorpay refund response missing id');
    }

    return {
      refundId: data.id,
      paymentId: data.payment_id ?? paymentId,
      amountInPaise: data.amount,
      status: data.status,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature || !/^[0-9a-f]+$/i.test(signature)) {
      return false;
    }
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(signature, 'hex');
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  parseWebhookEvent(rawBody: Buffer): PaymentWebhookEvent | null {
    let json: RazorpayWebhookPayload & Partial<PaymentWebhookEvent>;
    try {
      json = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return null;
    }

    // Direct envelope pass-through (e.g. from existing test suites or mock callers)
    if (json.providerEventId && json.orderId && json.status && json.amountInPaise !== undefined) {
      return {
        providerEventId: json.providerEventId,
        orderId: json.orderId,
        status: json.status,
        amountInPaise: json.amountInPaise,
        currency: json.currency ?? 'INR',
        providerReference: json.providerReference ?? null,
      };
    }

    // Razorpay standard webhook structure
    if (!json.event) {
      return null;
    }

    const payment = json.payload?.payment?.entity;
    const refund = json.payload?.refund?.entity;

    if (json.event === 'payment.captured') {
      if (!payment) return null;
      const orderId = payment.notes?.orderId || payment.order_id;
      if (!orderId) return null;

      return {
        providerEventId: json.id || payment.id,
        orderId,
        status: 'PAID',
        amountInPaise: payment.amount,
        currency: payment.currency || 'INR',
        providerReference: payment.id,
      };
    }

    if (json.event === 'payment.failed') {
      if (!payment) return null;
      const orderId = payment.notes?.orderId || payment.order_id;
      if (!orderId) return null;

      return {
        providerEventId: json.id || payment.id,
        orderId,
        status: 'FAILED',
        amountInPaise: payment.amount,
        currency: payment.currency || 'INR',
        providerReference: payment.id,
      };
    }

    if (json.event === 'refund.processed') {
      if (!refund) return null;
      const orderId = refund.notes?.orderId || refund.payment_id;
      if (!orderId) return null;

      return {
        providerEventId: json.id || refund.id,
        orderId,
        status: 'REFUNDED',
        amountInPaise: refund.amount,
        currency: refund.currency || 'INR',
        providerReference: refund.id,
      };
    }

    return null;
  }
}
