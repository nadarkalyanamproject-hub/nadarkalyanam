export const PAYMENT_GATEWAY_ADAPTER = Symbol('PAYMENT_GATEWAY_ADAPTER');

export interface ProviderOrder {
  providerOrderId: string;
  checkoutParams: Record<string, unknown>;
}

export interface PaymentWebhookEvent {
  providerEventId: string;
  orderId: string;
  status: 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  amountInPaise: number;
  currency: string;
  providerReference?: string | null;
}

export interface ProviderRefund {
  refundId: string;
  paymentId: string;
  amountInPaise: number;
  status: string;
}

// Behind an interface so the real provider (Razorpay/Cashfree/etc., per
// SRS §2.6's "payment gateway supporting required Indian payment methods
// with signed webhooks") can be swapped without touching PaymentsService —
// same principle as the component diagram's infra-adapter boxes.
export interface PaymentGatewayAdapter {
  createProviderOrder(orderId: string, amountInPaise: number): Promise<ProviderOrder>;
  // Over the exact bytes received — never a re-serialized body.
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean;
  // Parse provider-specific payload into a normalized domain event
  parseWebhookEvent?(rawBody: Buffer): PaymentWebhookEvent | null;
  // Dispatch a refund request to the provider for a captured payment
  refund?(paymentId: string, amountInPaise: number, reason?: string, orderId?: string): Promise<ProviderRefund>;
  // Set (to `true`) only by the stub implementation — see
  // common/not-yet-available.exception.ts.
  readonly isStub?: boolean;
}

