'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { claimAuthRedirect, onUnauthorized, releaseAuthRedirectClaim } from '../../lib/auth-events';
import { REGISTRATION_STORAGE_KEY, type RegistrationDraft } from '../../lib/registration-types';

interface RegistrationContextValue {
  data: RegistrationDraft;
  hydrated: boolean;
  setPhoneNumber: (phoneNumber: string, fullNamePrefill?: string) => void;
  setDevOtp: (devOtp: string | undefined) => void;
  setAuth: (auth: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    hasProfile: boolean;
  }) => void;
  saveStep: <K extends 'basicDetails' | 'personal' | 'location' | 'additional'>(
    key: K,
    value: RegistrationDraft[K],
  ) => void;
  markProfileCreated: () => void;
  clearWizardDraft: () => void;
  clearAuth: () => void;
}

const RegistrationContext = createContext<RegistrationContextValue | null>(null);

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<RegistrationDraft>({});
  const [hydrated, setHydrated] = useState(false);
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;
    try {
      const raw = window.localStorage.getItem(REGISTRATION_STORAGE_KEY);
      // Reading localStorage must happen after mount (no `window` during SSR),
      // so this one-time hydration read can only run inside an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setData(JSON.parse(raw) as RegistrationDraft);
    } catch {
      // Corrupt or inaccessible storage — proceed with an empty draft.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage may be unavailable (private browsing, quota) — draft just won't survive a refresh.
    }
  }, [data, hydrated]);

  const setPhoneNumber = useCallback((phoneNumber: string, fullNamePrefill?: string) => {
    setData((prev) => ({ ...prev, phoneNumber, fullNamePrefill: fullNamePrefill ?? prev.fullNamePrefill }));
  }, []);

  const setDevOtp = useCallback((devOtp: string | undefined) => {
    setData((prev) => ({ ...prev, devOtp }));
  }, []);

  const setAuth = useCallback(
    (auth: { accessToken: string; refreshToken: string; userId: string; hasProfile: boolean }) => {
      setData((prev) => ({ ...prev, ...auth }));
    },
    [],
  );

  const saveStep = useCallback(
    <K extends 'basicDetails' | 'personal' | 'location' | 'additional'>(
      key: K,
      value: RegistrationDraft[K],
    ) => {
      setData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const markProfileCreated = useCallback(() => {
    setData((prev) => ({ ...prev, hasProfile: true }));
  }, []);

  const clearWizardDraft = useCallback(() => {
    setData((prev) => ({
      accessToken: prev.accessToken,
      refreshToken: prev.refreshToken,
      userId: prev.userId,
      hasProfile: prev.hasProfile,
    }));
  }, []);

  // Resets the whole draft, not just the auth fields — a stale/invalid
  // token means this session is done, and any in-progress onboarding wizard
  // data tied to it shouldn't carry over into whatever session comes next.
  const clearAuth = useCallback(() => {
    setData({});
  }, []);

  useEffect(() => {
    return onUnauthorized(() => {
      claimAuthRedirect();
      clearAuth();
      router.push('/');
    });
  }, [clearAuth, router]);

  // RegistrationProvider wraps the whole app, so it's the outermost
  // component reading `data` — React flushes passive effects bottom-up
  // within one commit, so every descendant guard effect that needed to see
  // an active claim for this render has already run by the time this one
  // does. Safe to release here so a claim never leaks into some unrelated
  // later change.
  useEffect(() => {
    releaseAuthRedirectClaim();
  }, [data]);

  return (
    <RegistrationContext.Provider
      value={{
        data,
        hydrated,
        setPhoneNumber,
        setDevOtp,
        setAuth,
        saveStep,
        markProfileCreated,
        clearWizardDraft,
        clearAuth,
      }}
    >
      {children}
    </RegistrationContext.Provider>
  );
}

export function useRegistration(): RegistrationContextValue {
  const ctx = useContext(RegistrationContext);
  if (!ctx) throw new Error('useRegistration must be used within a RegistrationProvider');
  return ctx;
}
