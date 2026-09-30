'use client';

import { useEffect, useState } from 'react';
import { Button } from '@nadar-kalyanam/ui';
import { ApiError, getShortlistStatus, shortlistProfile, unshortlistProfile } from '../../lib/api-client';
import { useRegistration } from '../../app/providers/registration-provider';

// Shortlist / Remove from shortlist toggle for one member's profile. Starts
// from the server's real state; a failed request leaves the toggle as it was.
export function ShortlistButton({ profileId }: { profileId: string }) {
  const { data } = useRegistration();
  const [shortlisted, setShortlisted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!data.accessToken) return;
    let cancelled = false;
    getShortlistStatus(data.accessToken, profileId)
      .then((result) => {
        if (!cancelled) setShortlisted(result.shortlisted);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load shortlist status.');
      });
    return () => {
      cancelled = true;
    };
  }, [data.accessToken, profileId]);

  async function toggle() {
    if (!data.accessToken || shortlisted === null) return;
    setBusy(true);
    setError(undefined);
    try {
      if (shortlisted) {
        await unshortlistProfile(data.accessToken, profileId);
        setShortlisted(false);
      } else {
        await shortlistProfile(data.accessToken, profileId);
        setShortlisted(true);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update your shortlist. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        disabled={shortlisted === null || busy}
        onClick={() => void toggle()}
        aria-pressed={shortlisted ?? false}
        data-testid="shortlist-toggle"
      >
        {busy ? 'Saving…' : shortlisted ? '★ Shortlisted — Remove' : '☆ Shortlist'}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
