'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useRegistration } from '../app/providers/registration-provider';

export function useRequireAuth(): { ready: boolean } {
  const router = useRouter();
  const { data, hydrated } = useRegistration();

  useEffect(() => {
    if (hydrated && !data.accessToken) {
      router.replace('/register');
    }
  }, [hydrated, data.accessToken, router]);

  return { ready: hydrated && Boolean(data.accessToken) };
}
