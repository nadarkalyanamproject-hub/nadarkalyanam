import type { RelationshipStatus } from '@nadar-kalyanam/schemas';

// The one place that decides what interest action a member card/detail
// offers, from the relationshipStatus the API returns. Every page renders
// this through <RelationshipAction>, never its own branching.
export type RelationshipActionView =
  | { kind: 'send'; label: 'Send Interest' }
  | { kind: 'sent'; label: 'Interest Sent' }
  | { kind: 'respond'; label: 'Respond'; href: '/interests' }
  | { kind: 'connected'; label: 'Message'; href: string };

export function relationshipActionView(
  status: RelationshipStatus,
  conversationId: string | null,
): RelationshipActionView {
  switch (status) {
    case 'CONNECTED':
      // Connected members are never offered "Send Interest" — only a way to
      // talk. Falls back to the inbox if the conversation id is unknown.
      return { kind: 'connected', label: 'Message', href: conversationId ? `/messages/${conversationId}` : '/messages' };
    case 'INTEREST_RECEIVED':
      return { kind: 'respond', label: 'Respond', href: '/interests' };
    case 'INTEREST_SENT':
      return { kind: 'sent', label: 'Interest Sent' };
    case 'NONE':
    default:
      return { kind: 'send', label: 'Send Interest' };
  }
}
