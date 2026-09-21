'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
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
}

const RegistrationContext = createContext<RegistrationContextValue | null>(null);

export function RegistrationProvider({ children }: { children: ReactNode }) {
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

  return (
    <RegistrationContext.Provider
      value={{ data, hydrated, setPhoneNumber, setDevOtp, setAuth, saveStep, markProfileCreated, clearWizardDraft }}
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
