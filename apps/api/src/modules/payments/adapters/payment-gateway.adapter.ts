export const PAYMENT_GATEWAY_ADAPTER = Symbol('PAYMENT_GATEWAY_ADAPTER');

export interface ProviderOrder {
  providerOrderId: string;
  checkoutParams: Record<string, unknown>;
}

// Behind an interface so the real provider (Razorpay/Cashfree/etc., per
// SRS §2.6's "payment gateway supporting required Indian payment methods
// with signed webhooks") can be swapped without touching PaymentsService —
// same principle as the component diagram's infra-adapter boxes.
export interface PaymentGatewayAdapter {
  createProviderOrder(orderId: string, amountInPaise: number): Promise<ProviderOrder>;
  verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean;
}
