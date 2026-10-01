'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// "Back" should return to wherever the user actually came from. The app
// router can't say whether the previous history entry is one of our own
// pages, so this tab records (in sessionStorage, which survives a reload)
// that an in-app navigation has happened. Going back is only safe when that
// is true AND the browser has a previous entry; otherwise — a bookmark,
// a shared link, a fresh tab — the page's own fallback is used instead.
const KEY = 'nk-in-app-navigation';

function readFlag(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function canGoBackInApp(): boolean {
  return typeof window !== 'undefined' && readFlag() && window.history.length > 1;
}

// Mounted once in the root layout: marks the tab as soon as the pathname
// changes after the first page load (i.e. any client-side navigation).
export function NavigationTracker() {
  const pathname = usePathname();
  const firstPath = useRef(pathname);
  useEffect(() => {
    if (pathname === firstPath.current) return;
    try {
      window.sessionStorage.setItem(KEY, '1');
    } catch {
      // Storage unavailable: Back just uses the fallback.
    }
  }, [pathname]);
  return null;
}

const noopSubscribe = () => () => {};

// Back to the previous in-app page, or to `fallback` when there isn't one.
// `hasHistory` lets the control label itself honestly ("Back" vs the
// fallback's name); it's false during server rendering.
export function useBackNavigation(fallback: string): { goBack: () => void; hasHistory: boolean } {
  const router = useRouter();
  const hasHistory = useSyncExternalStore(noopSubscribe, canGoBackInApp, () => false);
  const goBack = useCallback(() => {
    if (canGoBackInApp()) router.back();
    else router.push(fallback);
  }, [router, fallback]);
  return { goBack, hasHistory };
}
