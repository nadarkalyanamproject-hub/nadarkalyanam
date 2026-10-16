import { createHmac } from 'node:crypto';
import { BadGatewayException, InternalServerErrorException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RazorpayPaymentGatewayAdapter } from './razorpay-payment-gateway.adapter.js';

describe('RazorpayPaymentGatewayAdapter', () => {
  const keyId = 'rzp_test_samplekey';
  const keySecret = 'sample_secret_key';
  const webhookSecret = 'sample_webhook_secret';

  function buildAdapter(overrides?: { keyId?: string; keySecret?: string; webhookSecret?: string }) {
    const configService = {
      get: vi.fn((key: string) => {
        if (key === 'RAZORPAY_KEY_ID') return overrides?.keyId ?? keyId;
        if (key === 'RAZORPAY_KEY_SECRET') return overrides?.keySecret ?? keySecret;
        if (key === 'RAZORPAY_WEBHOOK_SECRET') return overrides?.webhookSecret ?? webhookSecret;
        if (key === 'PAYMENT_WEBHOOK_SECRET') return 'fallback_webhook_secret';
        return undefined;
      }),
    };
    return new RazorpayPaymentGatewayAdapter(configService as never);
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws InternalServerErrorException on initialization if keys are missing', () => {
    expect(() => buildAdapter({ keyId: '' })).toThrow(InternalServerErrorException);
    expect(() => buildAdapter({ keySecret: '' })).toThrow(InternalServerErrorException);
  });

  describe('createProviderOrder', () => {
    it('creates an order through Razorpay API and returns order ID and checkout params', async () => {
      const adapter = buildAdapter();
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'order_test_123', amount: 149900, currency: 'INR' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await adapter.createProviderOrder('order-uuid-1', 149900);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.razorpay.com/v1/orders',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            amount: 149900,
            currency: 'INR',
            receipt: 'order-uuid-1',
            notes: { orderId: 'order-uuid-1' },
          }),
        }),
      );

      expect(result.providerOrderId).toBe('order_test_123');
      expect(result.checkoutParams).toEqual({
        key: keyId,
        amount: 149900,
        currency: 'INR',
        name: 'Nadar Kalyanam',
        description: 'Membership Subscription',
        order_id: 'order_test_123',
        theme: {
          color: '#680A0E',
        },
      });
    });

    it('throws BadGatewayException when Razorpay API responds with an error status', async () => {
      const adapter = buildAdapter();
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(adapter.createProviderOrder('order-uuid-1', 149900)).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws BadGatewayException on network fetch failure', async () => {
      const adapter = buildAdapter();
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection timed out'));
      vi.stubGlobal('fetch', mockFetch);

      await expect(adapter.createProviderOrder('order-uuid-1', 149900)).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('verifyWebhookSignature', () => {
    it('verifies valid HMAC-SHA256 signature over exact bytes', () => {
      const adapter = buildAdapter();
      const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured', test: 123 }));
      const signature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

      expect(adapter.verifyWebhookSignature(rawBody, signature)).toBe(true);
    });

    it('rejects tampered body or invalid signature', () => {
      const adapter = buildAdapter();
      const rawBody = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
      const tamperedBody = Buffer.from(JSON.stringify({ event: 'payment.captured', evil: true }));
      const signature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

      expect(adapter.verifyWebhookSignature(tamperedBody, signature)).toBe(false);
      expect(adapter.verifyWebhookSignature(rawBody, 'invalidhexsignature123')).toBe(false);
      expect(adapter.verifyWebhookSignature(rawBody, undefined)).toBe(false);
    });
  });

  describe('parseWebhookEvent', () => {
    it('parses payment.captured event into a normalized PaymentWebhookEvent', () => {
      const adapter = buildAdapter();
      const payload = {
        id: 'event_cap_1',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_001',
              order_id: 'order_rzp_001',
              amount: 149900,
              currency: 'INR',
              status: 'captured',
              notes: { orderId: 'order-uuid-1' },
            },
          },
        },
      };
      const rawBody = Buffer.from(JSON.stringify(payload));

      const event = adapter.parseWebhookEvent(rawBody);

      expect(event).toEqual({
        providerEventId: 'event_cap_1',
        orderId: 'order-uuid-1',
        status: 'PAID',
        amountInPaise: 149900,
        currency: 'INR',
        providerReference: 'pay_test_001',
      });
    });

    it('parses payment.failed event', () => {
      const adapter = buildAdapter();
      const payload = {
        id: 'event_fail_1',
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_002',
              order_id: 'order_rzp_001',
              amount: 149900,
              currency: 'INR',
              status: 'failed',
              notes: { orderId: 'order-uuid-1' },
            },
          },
        },
      };
      const rawBody = Buffer.from(JSON.stringify(payload));

      const event = adapter.parseWebhookEvent(rawBody);

      expect(event).toEqual({
        providerEventId: 'event_fail_1',
        orderId: 'order-uuid-1',
        status: 'FAILED',
        amountInPaise: 149900,
        currency: 'INR',
        providerReference: 'pay_test_002',
      });
    });

    it('parses refund.processed event', () => {
      const adapter = buildAdapter();
      const payload = {
        id: 'event_rfnd_1',
        event: 'refund.processed',
        payload: {
          refund: {
            entity: {
              id: 'rfnd_test_001',
              payment_id: 'pay_test_001',
              amount: 149900,
              currency: 'INR',
              status: 'processed',
              notes: { orderId: 'order-uuid-1' },
            },
          },
        },
      };
      const rawBody = Buffer.from(JSON.stringify(payload));

      const event = adapter.parseWebhookEvent(rawBody);

      expect(event).toEqual({
        providerEventId: 'event_rfnd_1',
        orderId: 'order-uuid-1',
        status: 'REFUNDED',
        amountInPaise: 149900,
        currency: 'INR',
        providerReference: 'rfnd_test_001',
      });
    });

    it('returns null for unhandled or invalid event JSON', () => {
      const adapter = buildAdapter();
      expect(adapter.parseWebhookEvent(Buffer.from('not-json'))).toBeNull();
      expect(adapter.parseWebhookEvent(Buffer.from(JSON.stringify({ event: 'unsupported.event' })))).toBeNull();
    });
  });
});
