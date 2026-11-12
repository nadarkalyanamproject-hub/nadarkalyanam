import { describe, expect, it } from 'vitest';
import { computeDropdownPlacement, estimateDropdownHeight } from './dropdown-placement';

const base = { viewportTop: 0, viewportHeight: 900, gap: 4, margin: 8, minHeight: 120 };

describe('computeDropdownPlacement', () => {
  it('opens below when the panel fits below', () => {
    const p = computeDropdownPlacement({ ...base, triggerTop: 100, triggerBottom: 144, desiredHeight: 300 });
    expect(p.side).toBe('bottom');
    expect(p.maxHeight).toBe(300);
  });

  it('flips upward when the field is near the bottom and there is more room above', () => {
    // 900 - 840 - 12 = 48px below, 784px above.
    const p = computeDropdownPlacement({ ...base, triggerTop: 796, triggerBottom: 840, desiredHeight: 300 });
    expect(p.side).toBe('top');
    expect(p.maxHeight).toBe(300);
  });

  it('clamps the height to the space on the chosen side (minus gap and margin)', () => {
    // Below: 900 - 600 - 12 = 288; above: 556 - 12 = 544 -> top fits fully.
    // Make it not fit either side: desired 700.
    const p = computeDropdownPlacement({ ...base, triggerTop: 556, triggerBottom: 600, desiredHeight: 700 });
    expect(p.side).toBe('top');
    expect(p.maxHeight).toBe(544);
  });

  it('stays below when it does not fit but below has at least as much room', () => {
    const p = computeDropdownPlacement({ ...base, triggerTop: 200, triggerBottom: 244, desiredHeight: 800 });
    expect(p.side).toBe('bottom');
    expect(p.maxHeight).toBe(900 - 244 - 12);
  });

  it('treats the area under the mobile keyboard (visualViewport) as unavailable', () => {
    // 667px phone, keyboard leaves a 380px visual viewport. Trigger at 300-344.
    const p = computeDropdownPlacement({
      ...base,
      viewportHeight: 380,
      triggerTop: 300,
      triggerBottom: 344,
      desiredHeight: 330,
    });
    // Below: 380 - 344 - 12 = 24; above: 300 - 12 = 288.
    expect(p.side).toBe('top');
    expect(p.maxHeight).toBe(288);
  });

  it('accounts for a scrolled visual viewport (pinch zoom / iOS keyboard offset)', () => {
    const p = computeDropdownPlacement({
      ...base,
      viewportTop: 200,
      viewportHeight: 400,
      triggerTop: 250,
      triggerBottom: 294,
      desiredHeight: 200,
    });
    // Below: 600 - 294 - 12 = 294 -> fits below.
    expect(p.side).toBe('bottom');
    expect(p.spaceAbove).toBe(250 - 200 - 12);
  });

  it('never goes below the minimum height when both sides are cramped', () => {
    const p = computeDropdownPlacement({ ...base, viewportHeight: 140, triggerTop: 48, triggerBottom: 92, desiredHeight: 300 });
    expect(p.maxHeight).toBe(120);
  });

  it('does not inflate a short list to the minimum height', () => {
    const p = computeDropdownPlacement({ ...base, viewportHeight: 100, triggerTop: 20, triggerBottom: 64, desiredHeight: 80 });
    expect(p.maxHeight).toBe(80);
  });
});

describe('estimateDropdownHeight', () => {
  it('sizes a short list to its rows', () => {
    expect(estimateDropdownHeight({ optionCount: 3, searchable: false })).toBe(3 * 36 + 8);
  });

  it('caps a long searchable list and adds the search box', () => {
    expect(estimateDropdownHeight({ optionCount: 17, searchable: true })).toBe(50 + 240 + 8);
  });
});
