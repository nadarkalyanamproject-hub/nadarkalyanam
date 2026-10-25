'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { ProfileFor } from '@nadar-kalyanam/schemas';
import { claimAuthRedirect, onTokensRefreshed, onUnauthorized, releaseAuthRedirectClaim } from '../../lib/auth-events';
import {
  REGISTRATION_STORAGE_KEY,
  type RegistrationDraft,
  type WizardStepKey,
} from '../../lib/registration-types';
import { adoptStoredDraft, draftsEqual, lostSession, mergeDraftForWrite, parseDraft } from '../../lib/draft-sync';

interface RegistrationContextValue {
  data: RegistrationDraft;
  hydrated: boolean;
  setPhoneNumber: (
    phoneNumber: string,
    fullNamePrefill?: string,
    genderPrefill?: 'MALE' | 'FEMALE',
    profileForPrefill?: ProfileFor,
  ) => void;
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
  saveStepInput: (key: WizardStepKey, values: Record<string, string>) => void;
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
  // The draft as this tab last read it from, or wrote it to, storage. Every
  // tab shares the stored draft, and it's the source of truth for the
  // tokens: writes merge in only what this tab changed since (see
  // lib/draft-sync.ts), so a tab holding old tokens never writes them back
  // over a pair another tab has refreshed.
  const syncedRef = useRef<RegistrationDraft>({});

  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;
    try {
      const stored = parseDraft(window.localStorage.getItem(REGISTRATION_STORAGE_KEY));
      syncedRef.current = stored;
      // Reading localStorage must happen after mount (no `window` during SSR),
      // so this one-time hydration read can only run inside an effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(stored);
    } catch {
      // Corrupt or inaccessible storage — proceed with an empty draft.
    } finally {
      setHydrated(true);
    }
  }, []);

  // Another tab signed out, or a different account signed in: this tab's
  // page belongs to a session that's gone, so start over from the homepage.
  const leaveIfSessionLost = useCallback(
    (prev: RegistrationDraft, next: RegistrationDraft) => {
      if (!lostSession(prev, next)) return;
      claimAuthRedirect();
      router.push('/');
    },
    [router],
  );

  useEffect(() => {
    if (!hydrated || data === syncedRef.current) return;
    const prev = syncedRef.current;
    try {
      const raw = window.localStorage.getItem(REGISTRATION_STORAGE_KEY);
      const merged = mergeDraftForWrite(parseDraft(raw), prev, data);
      const serialized = JSON.stringify(merged);
      if (serialized !== raw) window.localStorage.setItem(REGISTRATION_STORAGE_KEY, serialized);
      if (draftsEqual(merged, data)) {
        syncedRef.current = data;
      } else {
        // Storage had newer tokens (or another account): adopt it.
        syncedRef.current = merged;
        setData(merged);
        leaveIfSessionLost(data, merged);
      }
    } catch {
      // Storage may be unavailable (private browsing, quota) — draft just won't survive a refresh.
      syncedRef.current = data;
    }
  }, [data, hydrated, leaveIfSessionLost]);

  // Another tab wrote the draft (refreshed tokens, signed in or out, saved a
  // step): pick it up. The event only fires in the other tabs, never in the
  // one that wrote.
  useEffect(() => {
    if (!hydrated) return;
    function handleStorage(event: StorageEvent) {
      if (event.storageArea !== window.localStorage) return;
      if (event.key !== null && event.key !== REGISTRATION_STORAGE_KEY) return;
      // key === null: storage was cleared.
      const incoming = parseDraft(event.key === null ? null : event.newValue);
      const synced = syncedRef.current;
      syncedRef.current = incoming;
      setData((current) => adoptStoredDraft(incoming, synced, current));
      leaveIfSessionLost(synced, incoming);
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [hydrated, leaveIfSessionLost]);

  const setPhoneNumber = useCallback(
    (phoneNumber: string, fullNamePrefill?: string, genderPrefill?: 'MALE' | 'FEMALE', profileForPrefill?: ProfileFor) => {
      setData((prev) =>
        prev.accessToken
          ? {
              ...prev,
              phoneNumber,
              fullNamePrefill: fullNamePrefill ?? prev.fullNamePrefill,
              genderPrefill: genderPrefill ?? prev.genderPrefill,
              profileForPrefill: profileForPrefill ?? prev.profileForPrefill,
            }
          : // No active session: this is a brand-new registration attempt, so
            // nothing left in storage (another account's draft) carries over.
            { phoneNumber, fullNamePrefill, genderPrefill, profileForPrefill },
      );
    },
    [],
  );

  const setDevOtp = useCallback((devOtp: string | undefined) => {
    setData((prev) => ({ ...prev, devOtp }));
  }, []);

  const setAuth = useCallback(
    (auth: { accessToken: string; refreshToken: string; userId: string; hasProfile: boolean }) => {
      // The same user signing back in resumes their own draft. A different
      // user never inherits whatever an earlier account left in storage
      // (e.g. a wizard abandoned without logging out on a shared browser).
      setData((prev) => (prev.userId && prev.userId !== auth.userId ? { ...auth } : { ...prev, ...auth }));
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

  // Raw step input (no validation) — see RegistrationDraft.stepInputs. Only
  // ever adds/replaces one step's entry; never touches the validated keys.
  const saveStepInput = useCallback((key: WizardStepKey, values: Record<string, string>) => {
    setData((prev) => ({ ...prev, stepInputs: { ...prev.stepInputs, [key]: values } }));
  }, []);

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

  // A silent refresh (api-client.ts) swapped the tokens: adopt them, keeping
  // everything else in the draft.
  useEffect(() => {
    return onTokensRefreshed((tokens) => {
      setData((prev) => (prev.accessToken ? { ...prev, ...tokens } : prev));
    });
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
        saveStepInput,
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
