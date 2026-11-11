import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveQueuedPhoto,
  approveVerification,
  listPendingPhotos,
  listVerifications,
  rejectQueuedPhoto,
  rejectVerification,
} from './api-client';

describe('Admin Queues API Client', () => {
  const token = 'test-admin-token';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Photo Moderation Queue', () => {
    it('listPendingPhotos makes GET request with pagination and auth header', async () => {
      const mockResponse = {
        items: [
          {
            id: 'p-1',
            url: 'https://cdn.example.com/p-1.jpg',
            profileId: 'prof-1',
            userId: 'usr-1',
            memberName: 'Kavitha',
            phoneNumber: '+919876543210',
            isPrimary: true,
            sortOrder: 0,
            createdAt: '2026-10-28T09:00:00Z',
          },
        ],
        total: 1,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await listPendingPhotos(token, { offset: 10, limit: 20 });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/admin/photos/pending?offset=10&limit=20'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('approveQueuedPhoto sends POST request to /admin/photos/:id/approve', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'p-1', status: 'APPROVED' }),
      } as Response);

      const result = await approveQueuedPhoto(token, 'p-1');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/admin/photos/p-1/approve'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        }),
      );
      expect(result).toEqual({ id: 'p-1', status: 'APPROVED' });
    });

    it('rejectQueuedPhoto sends POST request with reason in body', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'p-1', status: 'REJECTED', rejectionReason: 'Blurred' }),
      } as Response);

      const result = await rejectQueuedPhoto(token, 'p-1', 'Blurred');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/admin/photos/p-1/reject'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ reason: 'Blurred' }),
        }),
      );
      expect(result).toEqual({ id: 'p-1', status: 'REJECTED', rejectionReason: 'Blurred' });
    });
  });

  describe('Verification Queue', () => {
    it('listVerifications makes GET request with status filter and auth header', async () => {
      const mockResponse = {
        items: [
          {
            id: 'v-1',
            userId: 'usr-1',
            memberName: 'Raj',
            phoneNumber: '+919876543210',
            providerReference: 'ref-123',
            status: 'PENDING' as const,
            isProfileVerified: false,
            createdAt: '2026-10-28T09:00:00Z',
            decidedAt: null,
          },
        ],
        total: 1,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await listVerifications(token, { offset: 0, limit: 10, status: 'PENDING' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/admin/verifications?limit=10&status=PENDING'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        }),
      );
      expect(result).toEqual(mockResponse);
    });

    it('approveVerification sends POST request to /admin/verifications/:id/approve', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'v-1', status: 'SUCCEEDED', decidedAt: '2026-10-28T10:00:00Z' }),
      } as Response);

      const result = await approveVerification(token, 'v-1');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/admin/verifications/v-1/approve'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
        }),
      );
      expect(result.status).toBe('SUCCEEDED');
    });

    it('rejectVerification sends POST request with optional reason in body', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'v-1', status: 'FAILED', decidedAt: '2026-10-28T10:00:00Z' }),
      } as Response);

      const result = await rejectVerification(token, 'v-1', 'Name mismatch');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/admin/verifications/v-1/reject'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`,
          }),
          body: JSON.stringify({ reason: 'Name mismatch' }),
        }),
      );
      expect(result.status).toBe('FAILED');
    });
  });
});
