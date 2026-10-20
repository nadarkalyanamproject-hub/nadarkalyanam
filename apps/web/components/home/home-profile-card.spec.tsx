import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RelationshipStatus } from '@nadar-kalyanam/schemas';
import { HomeProfileCard, type HomeProfile } from './home-profile-card';

vi.mock('../../app/providers/registration-provider', () => ({
  useRegistration: () => ({ data: { accessToken: 't' } }),
}));

// No DOM in this test setup, so this checks the markup the click behaviour
// relies on: one stretched link to the profile, with the interest action
// outside it and layered above its overlay.
function render(relationshipStatus: RelationshipStatus, conversationId: string | null = null) {
  const profile: HomeProfile = {
    profileId: 'p1',
    fullName: 'Meena',
    age: 27,
    isVerified: true,
    primaryPhotoUrl: 'https://cdn.example.com/p1.jpg',
    profession: 'Engineer',
    city: 'Chennai',
    relationshipStatus,
    conversationId,
  };
  return renderToStaticMarkup(<HomeProfileCard profile={profile} />);
}

// The link's own attribute (the card's class also mentions data-card-link).
const LINK_ATTR = 'data-card-link="true"';
const anchors = (html: string) => [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);

describe('HomeProfileCard', () => {
  it('has one profile link, stretched over the card', () => {
    const html = render('NONE');
    const links = anchors(html).filter((a) => a.includes('href="/browse/p1"'));
    expect(links).toHaveLength(1);
    expect(links[0]).toContain(LINK_ATTR);
    expect(links[0]).toContain('after:absolute');
    expect(links[0]).toContain('after:inset-0');
    // React hoists an image preload <link> first; the card is the first <div>.
    expect(html.match(/<div class="([^"]*)"/)?.[1]).toMatch(/(^| )relative( |$)/);
  });

  it.each([
    // The home Send button wraps its label with a shine and heart icon.
    ['NONE', null, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*Send Interest/],
    ['INTEREST_RECEIVED', null, /<a\b[^>]*>Respond/],
    ['CONNECTED', 'conv1', /<a\b[^>]*>Message/],
  ] as const)('keeps the %s action outside the profile link and above its overlay', (status, conversationId, control) => {
    const html = render(status, conversationId);
    const linkStart = html.indexOf(LINK_ATTR);
    const linkEnd = html.indexOf('</a>', linkStart);
    const controlAt = html.search(control);
    expect(controlAt).toBeGreaterThan(linkEnd);
    // The action's wrapper is the nearest earlier element carrying data-relationship-status.
    const wrapper = html.slice(html.lastIndexOf('<div', html.indexOf('data-relationship-status')), html.indexOf('data-relationship-status'));
    expect(wrapper).toMatch(/\brelative\b/);
    expect(wrapper).toMatch(/\bz-10\b/);
  });

  it('never nests a link or button inside the profile link', () => {
    const html = render('NONE');
    const linkStart = html.indexOf(LINK_ATTR);
    const inner = html.slice(linkStart, html.indexOf('</a>', linkStart));
    expect(inner).not.toMatch(/<a\b|<button\b/);
  });
});
