'use client';

import { getPaymentHistory } from './api-client';

// Razorpay Checkout on the website. The server creates the order and sends
// the checkout parameters (key, order id, amount); the plan itself is only
// activated by the signed webhook, never by this page.

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };

function loadRazorpay(): Promise<RazorpayCtor> {
  const existing = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.onload = () => {
      const ctor = (window as unknown as { Razorpay?: RazorpayCtor }).Razorpay;
      if (ctor) resolve(ctor);
      else reject(new Error('Razorpay did not load'));
    };
    script.onerror = () => reject(new Error('Could not reach Razorpay. Check your internet connection.'));
    document.body.appendChild(script);
  });
}

// Opens the Razorpay window. Resolves 'paid' once Razorpay reports success,
// or 'dismissed' if the member closes it.
export async function openRazorpayCheckout(params: Record<string, unknown>): Promise<'paid' | 'dismissed'> {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve) => {
    const checkout = new Razorpay({
      ...params,
      theme: { color: '#7a1118' },
      handler: () => resolve('paid'),
      modal: { ondismiss: () => resolve('dismissed') },
    });
    checkout.open();
  });
}

// The plan starts when the provider's webhook reaches the server, a moment
// after the payment. Waits (up to ~30 s) until the order shows as paid.
export async function waitForPaid(accessToken: string, orderId: string, timeoutMs = 30_000): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const history = await getPaymentHistory(accessToken);
      if (history.items.some((item) => item.orderId === orderId && item.status === 'PAID')) return true;
    } catch {
      // Keep trying until the deadline.
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

// Development only: a pretend payment (the API refuses it in production).
export const TEST_PAYMENTS = process.env.NODE_ENV !== 'production';
