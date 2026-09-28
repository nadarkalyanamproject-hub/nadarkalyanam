'use client';

import { useEffect, useState } from 'react';
import { useAdminAuth } from '../app/providers/admin-auth-provider';
import { ApiError, getCurrentAdmin, type CurrentAdmin } from './api-client';

// One GET /admin/me per access token, shared by every component that asks
// (the shell's nav and any page gating on a permission).
let cached: { token: string; promise: Promise<CurrentAdmin> } | null = null;

function loadCurrentAdmin(token: string): Promise<CurrentAdmin> {
  if (!cached || cached.token !== token) {
    cached = { token, promise: getCurrentAdmin(token) };
    cached.promise.catch(() => {
      cached = null;
    });
  }
  return cached.promise;
}

// The signed-in admin and their permission codes. Only drives what the UI
// shows — the API enforces every permission itself. A 401 (expired token or
// a deactivated admin) signs the admin out.
export function useCurrentAdmin(): { admin: CurrentAdmin | null; can: (permission: string) => boolean } {
  const { data, clearAuth } = useAdminAuth();
  const [admin, setAdmin] = useState<CurrentAdmin | null>(null);

  useEffect(() => {
    if (!data.accessToken) return;
    let cancelled = false;
    loadCurrentAdmin(data.accessToken)
      .then((result) => {
        if (!cancelled) setAdmin(result);
      })
      .catch((err: unknown) => {
        if (!cancelled && err instanceof ApiError && err.status === 401) clearAuth();
      });
    return () => {
      cancelled = true;
    };
  }, [data.accessToken, clearAuth]);

  return { admin, can: (permission) => Boolean(admin?.permissions.includes(permission)) };
}
