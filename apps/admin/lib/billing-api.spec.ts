import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  downloadOrdersCsv,
  exportOrdersToCsv,
  formatDate,
  listAllOrders,
  rupees,
  type AdminOrder,
} from './billing-api';

const HEADER =
  'Order ID,Member Name,Member Phone,Plan Name,Plan Code,Amount (INR),Status,Created At (IST),Paid At (IST),Refunded At (IST),Refund Reason,Refunded By';

function order(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return {
    id: 'ord_123',
    member: { userId: 'usr_001', fullName: 'Jane Doe', phoneNumber: '+919876543210', status: 'ACTIVE' },
    plan: { id: 'plan_gold', code: 'GOLD_PREMIUM', name: 'Gold Premium Plan' },
    amountInPaise: 149900,
    status: 'PAID',
    createdAt: '2026-10-25T10:00:00.000Z',
    paidAt: '2026-10-25T10:05:00.000Z',
    refundedAt: null,
    refundReason: null,
    refundedByEmail: null,
    subscription: { id: 'sub_001', state: 'ACTIVE' },
    ...overrides,
  };
}

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
    it('writes the header and a row with decimal INR and IST timestamps', () => {
      const lines = exportOrdersToCsv([order()]).split('\r\n');
      expect(lines[0]).toBe(HEADER);
      // 10:05 UTC is 15:35 IST; the +91 phone is kept as text.
      expect(lines[1]).toBe(
        "ord_123,Jane Doe,'+919876543210,Gold Premium Plan,GOLD_PREMIUM,1499.00,PAID,25-10-2026 15:30,25-10-2026 15:35,,,",
      );
    });

    it('uses the IST calendar day for times after 18:30 UTC', () => {
      const line = exportOrdersToCsv([order({ createdAt: '2026-10-25T19:00:00.000Z' })]).split('\r\n')[1];
      expect(line).toContain('26-10-2026 00:30');
    });

    it('escapes commas, quotes and newlines RFC 4180 style', () => {
      const line = exportOrdersToCsv([
        order({
          member: { userId: 'u2', fullName: 'Smith, John "The Great"', phoneNumber: '+919876543211', status: 'ACTIVE' },
          plan: { id: 'p', code: 'SILVER', name: 'Silver, 3-Month Plan' },
          amountInPaise: 79900,
          status: 'REFUNDED',
          refundedAt: '2026-10-21T11:00:00.000Z',
          refundReason: 'Double payment,\nrequested refund.',
          refundedByEmail: 'finance@nadarkalyanam.com',
        }),
      ]).split('\r\n').slice(1).join('\r\n');
      expect(line).toContain('"Smith, John ""The Great"""');
      expect(line).toContain('"Silver, 3-Month Plan"');
      expect(line).toContain('"Double payment,\nrequested refund."');
      expect(line).toContain('799.00');
      expect(line).toContain('finance@nadarkalyanam.com');
    });

    it('stops spreadsheet formulas in member-typed text', () => {
      const line = exportOrdersToCsv([
        order({
          member: { userId: 'u3', fullName: '=HYPERLINK("http://x","y")', phoneNumber: '+919876543212', status: 'ACTIVE' },
          refundReason: '@SUM(A1)',
        }),
      ]).split('\r\n')[1];
      expect(line).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
      expect(line).toContain("'@SUM(A1)");
    });

    it('leaves a blank cell for a missing name', () => {
      const line = exportOrdersToCsv([order({ member: { userId: 'u4', fullName: null, phoneNumber: '+919876543213', status: 'ACTIVE' } })]).split('\r\n')[1];
      expect(line.startsWith('ord_123,,')).toBe(true);
    });

    it('handles an empty orders list', () => {
      expect(exportOrdersToCsv([])).toBe(HEADER);
    });
  });

  describe('listAllOrders', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('fetches every page for the filters, not just the first', async () => {
      const total = 230;
      const offsets: number[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          const params = new URL(url, 'http://test').searchParams;
          const offset = Number(params.get('offset'));
          offsets.push(offset);
          expect(params.get('status')).toBe('PAID');
          const count = Math.min(Number(params.get('limit')), total - offset);
          const items = Array.from({ length: count }, (_, i) => order({ id: `ord_${offset + i}` }));
          return new Response(JSON.stringify({ items, total }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }),
      );

      const all = await listAllOrders('token', { status: 'PAID' });
      expect(all).toHaveLength(total);
      expect(offsets).toEqual([0, 100, 200]);
    });
  });

  describe('downloadOrdersCsv', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('does nothing on the server, where document is undefined', () => {
      vi.stubGlobal('document', undefined);
      expect(() => downloadOrdersCsv([], 'test.csv')).not.toThrow();
    });

    it('creates and clicks an anchor element to trigger download in browser', () => {
      const mockAnchor = { setAttribute: vi.fn(), click: vi.fn() };
      const appendChild = vi.fn();
      const removeChild = vi.fn();
      vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(mockAnchor), body: { appendChild, removeChild } });
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      downloadOrdersCsv([], 'test-orders.csv');

      expect(createObjectURL).toHaveBeenCalled();
      expect(mockAnchor.setAttribute).toHaveBeenCalledWith('download', 'test-orders.csv');
      expect(appendChild).toHaveBeenCalledWith(mockAnchor);
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(removeChild).toHaveBeenCalledWith(mockAnchor);
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
    });
  });
});
