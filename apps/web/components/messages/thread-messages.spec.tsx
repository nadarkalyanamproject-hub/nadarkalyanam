import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MessageResponse } from '@nadar-kalyanam/schemas';
import { ThreadMessages } from './thread-messages';

// No DOM in this test setup, so this checks the rendered markup.
const originalTz = process.env.TZ;
beforeEach(() => {
  process.env.TZ = 'Asia/Kolkata';
});
afterEach(() => {
  process.env.TZ = originalTz;
});

const message = (id: string, senderId: string, createdAt: string, body = 'Hello', status: MessageResponse['status'] = 'SENT'): MessageResponse => ({
  id,
  conversationId: 'c1',
  senderId,
  body,
  status,
  createdAt,
});

const render = (messages: MessageResponse[]) =>
  renderToStaticMarkup(<ThreadMessages messages={messages} ownUserId="me" now={new Date('2026-10-12T10:00:00+05:30')} />);

// The class list of the time/ticks container (React writes class first).
const metaClass = (html: string) => html.match(/<span class="([^"]*)" data-testid="message-meta"/)?.[1] ?? '';

// Visible text in document order, with screen-reader-only text included.
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('ThreadMessages', () => {
  const thread = [
    message('m1', 'them', '2026-10-11T21:05:00+05:30', 'Good night'),
    message('m2', 'me', '2026-10-12T08:15:00+05:30', 'Morning!', 'READ'),
    message('m3', 'them', '2026-10-12T08:20:00+05:30', 'Line one\nLine two'),
  ];

  it('puts a day separator before the first message of each day', () => {
    const html = render(thread);
    expect(html.match(/data-testid="day-separator"/g)).toHaveLength(2);
    expect(text(html)).toMatch(/^Yesterday Good night 9:05 PM Today Morning! 8:15 AM Read Line one Line two 8:20 AM$/);
    // The line break survives in the bubble (whitespace-pre-wrap).
    expect(html).toContain('Line one\nLine two');
    expect(html).toContain('<time dateTime="2026-10-11"');
    expect(html).toContain('<time dateTime="2026-10-12"');
  });

  it('gives every bubble its clock time in a <time> with the full date as tooltip', () => {
    const html = render(thread);
    expect(html).toContain(`<time dateTime="${new Date('2026-10-12T08:15:00+05:30').toISOString()}" title="`);
    expect(html.match(/data-testid="message-meta"/g)).toHaveLength(3);
  });

  it('own messages: time first, then the read ticks, inside the bubble', () => {
    const html = render([message('m2', 'me', '2026-10-12T08:15:00+05:30', 'Morning!', 'READ')]);
    const meta = html.slice(html.indexOf('data-testid="message-meta"'));
    expect(meta.indexOf('8:15 AM')).toBeGreaterThan(-1);
    expect(meta.indexOf('8:15 AM')).toBeLessThan(meta.indexOf('data-receipt="read"'));
    expect(metaClass(html)).toContain('text-primary-foreground/75');
  });

  it("the other member's messages: time without ticks, in the muted colour", () => {
    const html = render([message('m1', 'them', '2026-10-12T09:00:00+05:30')]);
    expect(html).not.toContain('data-receipt');
    expect(metaClass(html)).toContain('text-muted-foreground');
  });

  it('the time floats right after the text, so short bubbles stay narrow and long ones wrap', () => {
    const html = render([message('m1', 'them', '2026-10-12T09:00:00+05:30', 'Hi')]);
    expect(html).toMatch(/max-w-\[75%\] whitespace-pre-wrap break-words/);
    expect(html).toMatch(/data-testid="message-meta"/);
    expect(html).toMatch(/class="float-right[^"]*whitespace-nowrap/);
  });

  it('an invalid date: no time, no separator, no "Invalid Date"', () => {
    const html = render([message('bad', 'them', 'not-a-date', 'Hmm')]);
    expect(html).not.toContain('day-separator');
    expect(html).not.toContain('<time');
    expect(html).not.toContain('Invalid Date');
    expect(text(html)).toBe('Hmm');
  });
});
