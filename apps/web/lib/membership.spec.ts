import { describe, expect, it } from 'vitest';
import { durationLabel, formatPrice, whatsappHref } from './membership';

describe('membership display helpers', () => {
  it('formats paise as rupees', () => {
    expect(formatPrice(149900)).toBe('₹1,499');
    expect(formatPrice(1499900)).toBe('₹14,999');
  });

  it('labels plan durations', () => {
    expect(durationLabel(90)).toBe('3 months');
    expect(durationLabel(180)).toBe('6 months');
    expect(durationLabel(365)).toBe('12 months');
    expect(durationLabel(30)).toBe('1 month');
    expect(durationLabel(45)).toBe('45 days');
  });

  it('builds a WhatsApp link only from a real-looking number', () => {
    expect(whatsappHref('919812345678', 'Hi there')).toBe('https://wa.me/919812345678?text=Hi%20there');
    expect(whatsappHref('+91 98123 45678', 'x')).toBe('https://wa.me/919812345678?text=x');
    expect(whatsappHref(undefined, 'x')).toBeNull();
    expect(whatsappHref('', 'x')).toBeNull();
    expect(whatsappHref('call-us', 'x')).toBeNull();
  });
});
