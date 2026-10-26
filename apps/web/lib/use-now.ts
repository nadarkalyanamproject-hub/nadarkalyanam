'use client';

import { useEffect, useState } from 'react';
import { scheduleDayRollover } from './message-time';

// The current time, refreshed when the local day rolls over and whenever
// the member comes back to the tab, so day-based labels ("Yesterday") stay
// right on a page left open overnight. Never ticks more often than that.
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const cancelRollover = scheduleDayRollover(refresh);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', refresh);
    return () => {
      cancelRollover();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return now;
}
