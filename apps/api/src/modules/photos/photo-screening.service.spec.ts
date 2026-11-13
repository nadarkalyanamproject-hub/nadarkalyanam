import { describe, expect, it } from 'vitest';
import { type ScreeningScores, screeningVerdict } from './photo-screening.service.js';

const s = (over: Partial<ScreeningScores>): ScreeningScores => ({ neutral: 0, drawing: 0, sexy: 0, porn: 0, hentai: 0, ...over });

describe('screeningVerdict', () => {
  it('blocks explicit photos', () => {
    expect(screeningVerdict(s({ porn: 0.6 }))).toBe('BLOCK');
    expect(screeningVerdict(s({ hentai: 0.75 }))).toBe('BLOCK');
  });

  it('blocks confident half-naked photos (Sexy class)', () => {
    expect(screeningVerdict(s({ sexy: 0.7 }))).toBe('BLOCK');
    expect(screeningVerdict(s({ sexy: 0.93, neutral: 0.07 }))).toBe('BLOCK');
  });

  it('blocks when the explicit classes together are confident', () => {
    expect(screeningVerdict(s({ sexy: 0.5, porn: 0.36 }))).toBe('BLOCK');
  });

  it('sends a clothed saree photo (real test scores) to staff, not a refusal', () => {
    expect(screeningVerdict(s({ neutral: 0.389, sexy: 0.386, drawing: 0.123, hentai: 0.069, porn: 0.033 }))).toBe('REVIEW');
  });

  it('clears ordinary photos', () => {
    expect(screeningVerdict(s({ neutral: 0.703, drawing: 0.283, hentai: 0.011, sexy: 0.002, porn: 0.002 }))).toBe('CLEAR');
    expect(screeningVerdict(s({ neutral: 0.843, drawing: 0.121, hentai: 0.034, sexy: 0.001, porn: 0.001 }))).toBe('CLEAR');
  });
});
