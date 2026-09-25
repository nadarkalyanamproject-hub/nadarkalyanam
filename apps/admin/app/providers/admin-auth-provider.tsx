'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'nadar-admin-auth';

interface AdminAuthData {
  accessToken?: string;
  refreshToken?: string;
  adminUserId?: string;
}

interface AdminAuthContextValue {
  data: AdminAuthData;
  hydrated: boolean;
  setAuth: (auth: { accessToken: string; refreshToken: string; adminUserId: string }) => void;
  clearAuth: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminAuthData>({});
  const [hydrated, setHydrated] = useState(false);
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setData(JSON.parse(raw) as AdminAuthData);
    } catch {
      // Corrupt or inaccessible storage — proceed logged out.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage may be unavailable — session just won't survive a refresh.
    }
  }, [data, hydrated]);

  const setAuth = useCallback((auth: { accessToken: string; refreshToken: string; adminUserId: string }) => {
    setData(auth);
  }, []);

  const clearAuth = useCallback(() => {
    setData({});
  }, []);

  return (
    <AdminAuthContext.Provider value={{ data, hydrated, setAuth, clearAuth }}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  return ctx;
}
