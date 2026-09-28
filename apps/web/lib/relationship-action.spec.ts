import { describe, expect, it } from 'vitest';
import { relationshipActionView } from './relationship-action';

describe('relationshipActionView', () => {
  it('NONE offers Send Interest', () => {
    expect(relationshipActionView('NONE', null)).toEqual({ kind: 'send', label: 'Send Interest' });
  });

  it('INTEREST_SENT shows the (disabled) Interest Sent state', () => {
    expect(relationshipActionView('INTEREST_SENT', null)).toEqual({ kind: 'sent', label: 'Interest Sent' });
  });

  it('INTEREST_RECEIVED sends the member to /interests to respond — never offers Send', () => {
    expect(relationshipActionView('INTEREST_RECEIVED', null)).toEqual({
      kind: 'respond',
      label: 'Respond',
      href: '/interests',
    });
  });

  it('CONNECTED offers Message to that conversation, and never Send Interest', () => {
    const view = relationshipActionView('CONNECTED', 'conv-1');

    expect(view).toEqual({ kind: 'connected', label: 'Message', href: '/messages/conv-1' });
    expect(view.label).not.toBe('Send Interest');
  });

  it('CONNECTED without a conversation id falls back to the inbox', () => {
    expect(relationshipActionView('CONNECTED', null)).toMatchObject({ href: '/messages' });
  });
});
