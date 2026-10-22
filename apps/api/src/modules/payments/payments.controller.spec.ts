/* eslint-disable @typescript-eslint/no-explicit-any */
import { StreamableFile } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/guards/jwt-auth.guard.js';
import { PaymentsController } from './payments.controller.js';

describe('PaymentsController', () => {
  const user: AuthenticatedUser = {
    userId: 'user-1',
    sessionId: 'session-1',
  };

  it('downloadReceipt sets Content-Type, Content-Disposition and returns StreamableFile', async () => {
    const mockPdfBuffer = Buffer.from('%PDF-1.4 mock content');
    const mockPaymentsService: any = {
      getReceiptPdf: vi.fn().mockResolvedValue({
        buffer: mockPdfBuffer,
        filename: 'receipt-REC-12345.pdf',
      }),
    };

    const controller = new PaymentsController(mockPaymentsService);
    const mockRes: any = {
      set: vi.fn(),
    };

    const result = await controller.downloadReceipt(user, 'pay-12345', mockRes);

    expect(mockPaymentsService.getReceiptPdf).toHaveBeenCalledWith('user-1', 'pay-12345');
    expect(mockRes.set).toHaveBeenCalledWith({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="receipt-REC-12345.pdf"',
      'Content-Length': mockPdfBuffer.length.toString(),
    });
    expect(result).toBeInstanceOf(StreamableFile);
  });
});
