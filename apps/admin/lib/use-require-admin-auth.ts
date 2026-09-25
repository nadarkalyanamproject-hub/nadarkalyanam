'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAdminAuth } from '../app/providers/admin-auth-provider';

export function useRequireAdminAuth(): { ready: boolean } {
  const router = useRouter();
  const { data, hydrated } = useAdminAuth();

  useEffect(() => {
    if (hydrated && !data.accessToken) {
      router.replace('/login');
    }
  }, [hydrated, data.accessToken, router]);

  return { ready: hydrated && Boolean(data.accessToken) };
}
