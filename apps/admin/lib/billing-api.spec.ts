import { describe, expect, it, vi } from 'vitest';
import {
  downloadOrdersCsv,
  exportOrdersToCsv,
  formatDate,
  rupees,
  type AdminOrder,
} from './billing-api';

describe('Admin Billing API Utilities', () => {
  describe('rupees', () => {
    it('formats integer paise into Indian currency with rupees symbol', () => {
      expect(rupees(149900)).toBe('₹1,499');
      expect(rupees(50000)).toBe('₹500');
      expect(rupees(0)).toBe('₹0');
    });

    it('formats fractional paise with up to 2 decimal places', () => {
      expect(rupees(9950)).toBe('₹99.5');
      expect(rupees(9925)).toBe('₹99.25');
    });

    it('formats large numbers using Indian grouping (lakhs)', () => {
      expect(rupees(10000000)).toBe('₹1,00,000');
    });
  });

  describe('formatDate', () => {
    it('returns a dash for null dates', () => {
      expect(formatDate(null)).toBe('—');
    });

    it('formats ISO timestamps to en-IN date in IST', () => {
      const formatted = formatDate('2026-10-27T10:00:00.000Z');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Oct');
      expect(formatted).toContain('27');
    });
  });

  describe('exportOrdersToCsv', () => {
    const mockOrders: AdminOrder[] = [
      {
        id: 'ord_123',
        member: {
          userId: 'usr_001',
          fullName: 'Jane Doe',
          phoneNumber: '+919876543210',
          status: 'ACTIVE',
        },
        plan: {
          id: 'plan_gold',
          code: 'GOLD_PREMIUM',
          name: 'Gold Premium Plan',
        },
        amountInPaise: 149900,
        status: 'PAID',
        createdAt: '2026-10-25T10:00:00.000Z',
        paidAt: '2026-10-25T10:05:00.000Z',
        refundedAt: null,
        refundReason: null,
        refundedByEmail: null,
        subscription: { id: 'sub_001', state: 'ACTIVE' },
      },
      {
        id: 'ord_456',
        member: {
          userId: 'usr_002',
          fullName: 'Smith, John "The Great"',
          phoneNumber: '+919876543211',
          status: 'ACTIVE',
        },
        plan: {
          id: 'plan_silver',
          code: 'SILVER',
          name: 'Silver, 3-Month Plan',
        },
        amountInPaise: 79900,
        status: 'REFUNDED',
        createdAt: '2026-10-20T10:00:00.000Z',
        paidAt: '2026-10-20T10:05:00.000Z',
        refundedAt: '2026-10-21T11:00:00.000Z',
        refundReason: 'Accidental double payment, requested refund.',
        refundedByEmail: 'finance@nadarkalyanam.com',
        subscription: null,
      },
    ];

    it('includes all standard CSV headers', () => {
      const csv = exportOrdersToCsv(mockOrders);
      const lines = csv.split('\r\n');
      expect(lines[0]).toBe(
        'Order ID,Member Name,Member Phone,Plan Name,Plan Code,Amount (INR),Status,Created At,Paid At,Refunded At,Refund Reason,Refunded By',
      );
    });

    it('formats rows accurately with decimal INR amount', () => {
      const csv = exportOrdersToCsv(mockOrders);
      const lines = csv.split('\r\n');
      expect(lines).toHaveLength(3);

      expect(lines[1]).toContain('ord_123');
      expect(lines[1]).toContain('Jane Doe');
      expect(lines[1]).toContain('+919876543210');
      expect(lines[1]).toContain('Gold Premium Plan');
      expect(lines[1]).toContain('GOLD_PREMIUM');
      expect(lines[1]).toContain('1499.00');
      expect(lines[1]).toContain('PAID');
    });

    it('escapes fields containing commas, double quotes, and special characters RFC 4180 style', () => {
      const csv = exportOrdersToCsv(mockOrders);
      const lines = csv.split('\r\n');
      const secondRow = lines[2];

      // "Smith, John ""The Great"""
      expect(secondRow).toContain('"Smith, John ""The Great"""');
      // "Silver, 3-Month Plan"
      expect(secondRow).toContain('"Silver, 3-Month Plan"');
      // "Accidental double payment, requested refund."
      expect(secondRow).toContain('"Accidental double payment, requested refund."');
      expect(secondRow).toContain('799.00');
      expect(secondRow).toContain('REFUNDED');
      expect(secondRow).toContain('finance@nadarkalyanam.com');
    });

    it('handles empty orders list gracefully', () => {
      const csv = exportOrdersToCsv([]);
      expect(csv).toBe(
        'Order ID,Member Name,Member Phone,Plan Name,Plan Code,Amount (INR),Status,Created At,Paid At,Refunded At,Refund Reason,Refunded By',
      );
    });
  });

  describe('downloadOrdersCsv', () => {
    it('gracefully exits on server-side when document is undefined', () => {
      const origDoc = globalThis.document;
      (globalThis as unknown as { document?: Document }).document = undefined;
      expect(() => downloadOrdersCsv([], 'test.csv')).not.toThrow();
      globalThis.document = origDoc;
    });

    it('creates and clicks an anchor element to trigger download in browser', () => {
      const clickMock = vi.fn();
      const setAttributeMock = vi.fn();
      const mockAnchor = {
        setAttribute: setAttributeMock,
        click: clickMock,
      };

      const appendChildMock = vi.fn();
      const removeChildMock = vi.fn();

      globalThis.document = {
        createElement: vi.fn().mockReturnValue(mockAnchor),
        body: {
          appendChild: appendChildMock,
          removeChild: removeChildMock,
        },
      } as unknown as Document;

      const createObjectURLMock = vi.fn().mockReturnValue('blob:test');
      const revokeObjectURLMock = vi.fn();
      globalThis.URL.createObjectURL = createObjectURLMock;
      globalThis.URL.revokeObjectURL = revokeObjectURLMock;

      downloadOrdersCsv([], 'test-orders.csv');

      expect(createObjectURLMock).toHaveBeenCalled();
      expect(appendChildMock).toHaveBeenCalledWith(mockAnchor);
      expect(clickMock).toHaveBeenCalled();
      expect(removeChildMock).toHaveBeenCalledWith(mockAnchor);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test');
    });
  });
});
