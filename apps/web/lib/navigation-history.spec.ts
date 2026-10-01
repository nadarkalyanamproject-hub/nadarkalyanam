import { afterEach, describe, expect, it } from 'vitest';
import { canGoBackInApp } from './navigation-history';

function fakeWindow(flag: string | null, historyLength: number) {
  (globalThis as { window?: unknown }).window = {
    sessionStorage: { getItem: () => flag },
    history: { length: historyLength },
  };
}

describe('canGoBackInApp', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('goes back after an in-app navigation when the browser has a previous entry', () => {
    fakeWindow('1', 3);
    expect(canGoBackInApp()).toBe(true);
  });

  it('uses the fallback for a fresh tab / shared link (no in-app navigation yet)', () => {
    fakeWindow(null, 3); // e.g. arrived from another site
    expect(canGoBackInApp()).toBe(false);
  });

  it('uses the fallback when there is no previous entry even if the flag was copied to a new tab', () => {
    fakeWindow('1', 1);
    expect(canGoBackInApp()).toBe(false);
  });

  it('is false during server rendering', () => {
    expect(canGoBackInApp()).toBe(false);
  });
});
