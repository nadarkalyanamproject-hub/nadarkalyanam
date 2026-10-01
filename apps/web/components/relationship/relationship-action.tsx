'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { RelationshipStatus } from '@nadar-kalyanam/schemas';
import { Button } from '@nadar-kalyanam/ui';
import { ApiError, sendInterest } from '../../lib/api-client';
import { relationshipActionView } from '../../lib/relationship-action';
import { useRegistration } from '../../app/providers/registration-provider';

import { ArrowRight, Check, Heart, HeartHandshake, MessageCircle } from 'lucide-react';

// Visual variants only — each surface keeps its existing button look. The
// state -> action decision is relationshipActionView's, shared by all.
type Appearance = 'ui' | 'discovery' | 'home' | 'matches' | 'profile-hero';

const SEND_CLASSES: Record<Exclude<Appearance, 'ui' | 'profile-hero'>, string> = {
  discovery:
    'w-full rounded-lg bg-gradient-to-r from-[#94151C] to-[#7A0710] py-2 text-xs font-semibold text-white shadow-2xs transition-all hover:from-[#A81C24] hover:to-[#94151C] disabled:cursor-not-allowed disabled:opacity-60',
  home: 'w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-white hover:bg-[#FFF8F0] text-[#7B1118] border border-[#E7CDAF] disabled:cursor-not-allowed disabled:opacity-60',
  matches:
    'w-full text-xs font-semibold py-1.5 px-3 rounded-full text-center whitespace-nowrap transition-all cursor-pointer bg-[#7A1118] hover:bg-[#620D13] active:scale-[0.98] text-white shadow-xs disabled:cursor-not-allowed disabled:opacity-60',
};
const SENT_CLASSES: Record<Exclude<Appearance, 'ui' | 'profile-hero'>, string> = {
  discovery:
    'w-full rounded-lg bg-gradient-to-r from-[#94151C] to-[#7A0710] py-2 text-xs font-semibold text-white opacity-60 cursor-not-allowed',
  home: 'w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-[#F0FDF4] text-[#16A34A] border border-[#86EFAC] cursor-not-allowed',
  matches:
    'w-full text-xs font-semibold py-1.5 px-3 rounded-full text-center whitespace-nowrap bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default',
};
const LINK_CLASSES: Record<Exclude<Appearance, 'ui' | 'profile-hero'>, string> = {
  discovery:
    'block w-full rounded-lg bg-gradient-to-r from-[#94151C] to-[#7A0710] py-2 text-center text-xs font-semibold text-white shadow-2xs transition-all hover:from-[#A81C24] hover:to-[#94151C]',
  home: 'w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all bg-[#7B1118] text-white hover:bg-[#650B11]',
  matches:
    'block w-full text-xs font-semibold py-1.5 px-3 rounded-full text-center whitespace-nowrap transition-all bg-[#7A1118] hover:bg-[#620D13] text-white shadow-xs',
};

// "Connected" label, shown next to a connected member's name on every
// surface. Uses the theme's primary (maroon) token so it reads as a
// relationship marker, distinct from the gold "Verified"/score badges.
export function ConnectedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary ${className}`}
    >
      <span aria-hidden="true">✓</span> Connected
    </span>
  );
}

// The interest action for one member: Send Interest / Interest Sent /
// Respond / Message, per relationshipStatus. Owns the send request, so a
// successful send flips this card to "Interest Sent" in place.
export function RelationshipAction({
  profileId,
  relationshipStatus,
  conversationId,
  appearance = 'ui',
  className = '',
}: {
  profileId: string;
  relationshipStatus: RelationshipStatus;
  conversationId: string | null;
  appearance?: Appearance;
  className?: string;
}) {
  const { data } = useRegistration();
  const [status, setStatus] = useState<RelationshipStatus>(relationshipStatus);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const view = relationshipActionView(status, conversationId);

  async function handleSend() {
    if (!data.accessToken) return;
    setSending(true);
    setError(undefined);
    try {
      await sendInterest(data.accessToken, { targetProfileId: profileId });
      setStatus('INTEREST_SENT');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send interest. Please try again.');
    } finally {
      setSending(false);
    }
  }

  let control: React.ReactNode;
  if (appearance === 'profile-hero') {
    if (view.kind === 'send') {
      control = (
        <button
          type="button"
          disabled={sending}
          onClick={() => void handleSend()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7A1C32] hover:bg-[#681427] active:scale-[0.98] px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition-all disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Heart className="h-4 w-4 text-white" />
          <span>{sending ? 'Sending Interest…' : 'Send Interest'}</span>
          <ArrowRight className="h-4 w-4 text-white/90" />
        </button>
      );
    } else if (view.kind === 'sent') {
      control = (
        <button
          type="button"
          disabled
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FAF5F6] border border-[#F2D6DC] px-6 py-2.5 text-sm font-semibold text-[#7A1C32] shadow-xs cursor-default"
        >
          <Heart className="h-4 w-4 fill-[#7A1C32] text-[#7A1C32]" />
          <span>Interest Sent</span>
        </button>
      );
    } else if (view.kind === 'connected') {
      control = (
        <Link
          href={view.href}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7A1C32] hover:bg-[#681427] active:scale-[0.98] px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition-all"
        >
          <MessageCircle className="h-4 w-4 text-white" />
          <span>Message</span>
          <ArrowRight className="h-4 w-4 text-white/90" />
        </Link>
      );
    } else {
      control = (
        <Link
          href={view.href}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7A1C32] hover:bg-[#681427] active:scale-[0.98] px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition-all"
        >
          <HeartHandshake className="h-4 w-4 text-white" />
          <span>Respond to Interest</span>
          <ArrowRight className="h-4 w-4 text-white/90" />
        </Link>
      );
    }
  } else if (view.kind === 'send' || view.kind === 'sent') {
    const disabled = view.kind === 'sent' || sending;
    const label = view.kind === 'sent' ? view.label : sending ? 'Sending…' : view.label;
    control =
      appearance === 'ui' ? (
        <Button type="button" size="sm" className="w-full" disabled={disabled} onClick={() => void handleSend()}>
          {label}
        </Button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void handleSend()}
          className={view.kind === 'sent' ? SENT_CLASSES[appearance] : SEND_CLASSES[appearance]}
        >
          {view.kind === 'sent' && (appearance === 'discovery' || appearance === 'matches') ? `✓ ${label}` : label}
        </button>
      );
  } else {
    control =
      appearance === 'ui' ? (
        <Link href={view.href} className="block w-full">
          <Button type="button" size="sm" className="w-full" variant={view.kind === 'respond' ? 'outline' : 'primary'}>
            {view.label}
          </Button>
        </Link>
      ) : (
        <Link href={view.href} className={LINK_CLASSES[appearance]}>
          {view.label}
        </Link>
      );
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`} data-relationship-status={status}>
      {control}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
