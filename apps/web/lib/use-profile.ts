'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProfileResponse } from '@nadar-kalyanam/schemas';
import { useRegistration } from '../app/providers/registration-provider';
import { ApiError, getMyProfile } from './api-client';
import { createProfileLoader, shouldRefetchOnVisible } from './profile-loader';

interface UseProfileResult {
  profile: ProfileResponse | null;
  loading: boolean;
  error: string | null;
  setProfile: (profile: ProfileResponse) => void;
  refetch: () => Promise<void>;
}

export function useProfile(): UseProfileResult {
  const { data, hydrated } = useRegistration();
  // Tagged with the account it was loaded for, so a profile never shows
  // under another account (another tab can sign a different one in).
  const [loaded, setLoaded] = useState<{ userId: string | undefined; profile: ProfileResponse } | null>(null);
  const profile = loaded && loaded.userId === data.userId ? loaded.profile : null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Each retry reads the latest session, so a token refreshed mid-retry is used.
  const sessionRef = useRef({ accessToken: data.accessToken, userId: data.userId });
  useEffect(() => {
    sessionRef.current = { accessToken: data.accessToken, userId: data.userId };
  }, [data.accessToken, data.userId]);

  // One loader per hook instance, created on first use; concurrent calls
  // share its in-flight load.
  const loaderRef = useRef<(() => Promise<{ userId: string | undefined; profile: ProfileResponse }>) | null>(null);
  const loadProfile = useCallback(() => {
    loaderRef.current ??= createProfileLoader({
      load: async () => {
        const { accessToken, userId } = sessionRef.current;
        if (!accessToken) throw new ApiError('Not signed in.', 401);
        return { userId, profile: await getMyProfile(accessToken) };
      },
    });
    return loaderRef.current();
  }, []);

  const setProfile = useCallback((next: ProfileResponse) => {
    setLoaded({ userId: sessionRef.current.userId, profile: next });
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!data.accessToken) return;
    setError(null);
    try {
      let result = await loadProfile();
      // Joined a load started for the previous account: load again.
      if (result.userId !== sessionRef.current.userId) result = await loadProfile();
      setLoaded(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your profile.');
    } finally {
      setLoading(false);
    }
  }, [data.accessToken, loadProfile]);

  useEffect(() => {
    if (!hydrated || !data.accessToken) return;
    // Kicks off the initial fetch; the state it sets happens after an
    // await, not synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProfile();
  }, [hydrated, data.accessToken, fetchProfile]);

  // Back online, or back on this tab after a while away: the profile (or the
  // error from the last try) may be out of date.
  useEffect(() => {
    if (!hydrated || !data.accessToken) return;
    let hiddenAt: number | null = null;
    function handleVisibility() {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else {
        if (shouldRefetchOnVisible(hiddenAt, Date.now())) void fetchProfile();
        hiddenAt = null;
      }
    }
    function handleOnline() {
      void fetchProfile();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [hydrated, data.accessToken, fetchProfile]);

  return { profile, loading, error, setProfile, refetch: fetchProfile };
}
