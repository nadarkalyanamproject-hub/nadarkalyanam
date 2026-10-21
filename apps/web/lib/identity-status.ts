'use client';

import { useEffect, useState } from 'react';
import type { VerificationStatusResponse } from '@nadar-kalyanam/schemas';
import { getVerificationStatus } from './api-client';

// The member's DigiLocker status, fetched once per access token and shared by
// the site-wide gate (IdentityGate) and the forms that lock name and date of
// birth. The API enforces the gate itself (403 IDENTITY_REQUIRED); this only
// decides where to send the member.
let cache: { token: string; request: Promise<VerificationStatusResponse> } | null = null;

export function loadIdentityStatus(token: string): Promise<VerificationStatusResponse> {
  if (!cache || cache.token !== token) {
    const request = getVerificationStatus(token);
    cache = { token, request };
    request.catch(() => {
      if (cache?.request === request) cache = null;
    });
  }
  return cache.request;
}

// After the DigiLocker result comes back.
export function setIdentityStatus(token: string, status: VerificationStatusResponse): void {
  cache = { token, request: Promise.resolve(status) };
}

// undefined while loading; null when signed out or the lookup failed.
export function useIdentityStatus(token: string | undefined): VerificationStatusResponse | null | undefined {
  const [state, setState] = useState<{ token: string; status: VerificationStatusResponse | null } | null>(null);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    loadIdentityStatus(token)
      .then((status) => !cancelled && setState({ token, status }))
      .catch(() => !cancelled && setState({ token, status: null }));
    return () => {
      cancelled = true;
    };
  }, [token]);
  if (!token) return null;
  return state?.token === token ? state.status : undefined;
}
