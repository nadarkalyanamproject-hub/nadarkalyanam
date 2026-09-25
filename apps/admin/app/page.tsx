'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from './providers/admin-auth-provider';

export default function AdminHome() {
  const router = useRouter();
  const { data, hydrated } = useAdminAuth();

  useEffect(() => {
    if (!hydrated) return;
    router.replace(data.accessToken ? '/members' : '/login');
  }, [hydrated, data.accessToken, router]);

  return null;
}
