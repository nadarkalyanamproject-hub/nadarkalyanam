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
    'w-full rounded-lg bg-gradient-to-r from-nk-maroon-bright to-nk-maroon py-2 text-xs font-semibold text-white shadow-2xs transition-all hover:from-[#A81C24] hover:to-nk-maroon-bright disabled:cursor-not-allowed disabled:opacity-60',
  home: 'w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-white hover:bg-[#FFF8F0] text-nk-maroon border border-[#E7CDAF] disabled:cursor-not-allowed disabled:opacity-60',
  matches:
    'w-full text-xs font-semibold py-1.5 px-3 rounded-lg text-center whitespace-nowrap transition-all cursor-pointer bg-nk-maroon hover:bg-[#620D13] active:scale-[0.98] text-white shadow-xs disabled:cursor-not-allowed disabled:opacity-60',
};
const SENT_CLASSES: Record<Exclude<Appearance, 'ui' | 'profile-hero'>, string> = {
  discovery: 'w-full rounded-lg bg-[#15803D] py-2 text-xs font-semibold text-white cursor-default',
  home: 'w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-[#15803D] text-white cursor-default',
  matches: 'w-full text-xs font-semibold py-1.5 px-3 rounded-lg text-center whitespace-nowrap bg-[#15803D] text-white cursor-default',
};
const LINK_CLASSES: Record<Exclude<Appearance, 'ui' | 'profile-hero'>, string> = {
  discovery:
    'block w-full rounded-lg bg-gradient-to-r from-nk-maroon-bright to-nk-maroon py-2 text-center text-xs font-semibold text-white shadow-2xs transition-all hover:from-[#A81C24] hover:to-nk-maroon-bright',
  home: 'w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all bg-nk-maroon text-white hover:bg-nk-maroon-deep',
  matches:
    'block w-full text-xs font-semibold py-1.5 px-3 rounded-lg text-center whitespace-nowrap transition-all bg-nk-maroon hover:bg-[#620D13] text-white shadow-xs',
};

// "Connected" label, shown next to a connected member's name on every
// surface. Uses the theme's primary (maroon) token so it reads as a
// relationship marker, distinct from the gold "Verified"/score badges.
export function ConnectedBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold text-primary ${className}`}>
      <Check className="h-3 w-3" strokeWidth={2.75} aria-hidden="true" /> Connected
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
  const [justSent, setJustSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  // The free monthly interest limit: shown with a link to the plans.
  const [limitReached, setLimitReached] = useState(false);
  const view = relationshipActionView(status, conversationId);

  async function handleSend() {
    if (!data.accessToken) return;
    setSending(true);
    setError(undefined);
    setLimitReached(false);
    try {
      await sendInterest(data.accessToken, { targetProfileId: profileId });
      setStatus('INTEREST_SENT');
      setJustSent(true);
    } catch (err) {
      setLimitReached(err instanceof ApiError && err.code === 'PLAN_LIMIT_REACHED');
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
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-nk-maroon hover:bg-[#681427] active:scale-[0.98] px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition-all disabled:cursor-not-allowed disabled:opacity-60"
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
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#15803D] px-6 py-2.5 text-sm font-semibold text-white cursor-default"
        >
          <Check className="h-4 w-4" strokeWidth={2.75} />
          <span>Interest Sent</span>
        </button>
      );
    } else if (view.kind === 'connected') {
      control = (
        <Link
          href={view.href}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-nk-maroon hover:bg-[#681427] active:scale-[0.98] px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition-all"
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
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-nk-maroon hover:bg-[#681427] active:scale-[0.98] px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition-all"
        >
          <HeartHandshake className="h-4 w-4 text-white" />
          <span>Respond to Interest</span>
          <ArrowRight className="h-4 w-4 text-white/90" />
        </Link>
      );
    }
  } else if (appearance === 'home' && view.kind === 'sent') {
    // Solid green "sent" state, same shape as the Send button it replaces.
    // A short settle-in when this card's own send just landed.
    control = (
      <div
        role="status"
        className={`flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#15803D] px-3 py-2 text-xs font-semibold text-white ${justSent ? 'motion-safe:animate-nk-pop' : ''}`}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.75} />
        <span>{view.label}</span>
      </div>
    );
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
      {error ? (
        <p className="text-xs text-destructive" role="alert" data-testid={limitReached ? 'interest-limit' : undefined}>
          {error}
          {limitReached && (
            <>
              {' '}
              <Link href="/membership" className="font-semibold underline">
                Upgrade
              </Link>
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
