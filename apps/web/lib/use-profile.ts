'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProfileResponse } from '@nadar-kalyanam/schemas';
import { useRegistration } from '../app/providers/registration-provider';
import { ApiError, getMyProfile } from './api-client';

interface UseProfileResult {
  profile: ProfileResponse | null;
  loading: boolean;
  error: string | null;
  setProfile: (profile: ProfileResponse) => void;
  refetch: () => Promise<void>;
}

export function useProfile(): UseProfileResult {
  const { data, hydrated } = useRegistration();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!data.accessToken) return;
    setError(null);
    try {
      const result = await getMyProfile(data.accessToken);
      setProfile(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your profile.');
    } finally {
      setLoading(false);
    }
  }, [data.accessToken]);

  useEffect(() => {
    if (!hydrated || !data.accessToken) return;
    // Kicks off the initial fetch; the state it sets happens after an
    // await, not synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchProfile();
  }, [hydrated, data.accessToken, fetchProfile]);

  return { profile, loading, error, setProfile, refetch: fetchProfile };
}
