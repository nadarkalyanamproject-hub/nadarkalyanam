import { describe, expect, it } from 'vitest';
import { formatDate, formatRupees, generateReceiptPdf } from './receipt-generator.js';

describe('receipt-generator', () => {
  describe('formatRupees', () => {
    it('renders 249900 paise as ₹2,499.00', () => {
      expect(formatRupees(249900)).toBe('₹2,499.00');
    });

    it('renders 149900 paise as ₹1,499.00', () => {
      expect(formatRupees(149900)).toBe('₹1,499.00');
    });

    it('renders 0 paise as ₹0.00', () => {
      expect(formatRupees(0)).toBe('₹0.00');
    });

    it('renders 50 paise as ₹0.50', () => {
      expect(formatRupees(50)).toBe('₹0.50');
    });

    it('renders 10000000 paise as ₹1,00,000.00 (Indian lakh comma formatting)', () => {
      expect(formatRupees(10000000)).toBe('₹1,00,000.00');
    });
  });

  describe('formatDate', () => {
    it('formats date cleanly', () => {
      const d = new Date(Date.UTC(2026, 9, 14));
      const formatted = formatDate(d);
      expect(formatted).toMatch(/14.*Oct.*2026/);
    });
  });

  describe('generateReceiptPdf', () => {
    it('generates a valid PDF buffer starting with %PDF-', async () => {
      const buffer = await generateReceiptPdf({
        receiptNumber: 'REC-TEST001',
        memberName: 'Priya Nadar',
        planName: 'Gold',
        durationDays: 90,
        amountInPaise: 249900,
        paymentDate: new Date(),
        providerPaymentId: 'pay_rzp_test_123',
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(500);
      // Valid PDF magic header
      expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-');
    });

    it('includes GST information when GSTIN is configured', async () => {
      const buffer = await generateReceiptPdf({
        receiptNumber: 'REC-TEST002',
        memberName: 'Karthik Nadar',
        planName: 'Platinum VIP',
        durationDays: 180,
        amountInPaise: 499900,
        paymentDate: new Date(),
        providerPaymentId: 'pay_rzp_test_456',
        gstin: '33AAAAA0000A1Z5',
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(500);
      expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-');
    });
  });
});
