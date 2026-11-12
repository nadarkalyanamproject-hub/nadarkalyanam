// Where a dropdown panel opens and how tall it may be, from the trigger's
// rect and the visible viewport. Pure so it can be unit tested; SmartDropdown
// feeds it getBoundingClientRect() and window.visualViewport (which shrinks
// when the mobile keyboard is up, so the keyboard counts as "no room").

export interface DropdownPlacementInput {
  /** Trigger rect, in the same coordinates as `position: fixed`. */
  triggerTop: number;
  triggerBottom: number;
  /** Visible area: visualViewport.offsetTop / .height (or 0 / innerHeight). */
  viewportTop: number;
  viewportHeight: number;
  /** Height the panel would like (search box + list), before clamping. */
  desiredHeight: number;
  /** Gap between trigger and panel. */
  gap?: number;
  /** Space kept free between the panel and the viewport edge. */
  margin?: number;
  /** Never clamp the panel below this, even when both sides are cramped. */
  minHeight?: number;
}

export interface DropdownPlacement {
  side: 'bottom' | 'top';
  /** Max height for the panel; its list scrolls inside. */
  maxHeight: number;
  /** Space measured on each side (useful for tests/debugging). */
  spaceBelow: number;
  spaceAbove: number;
}

export function computeDropdownPlacement({
  triggerTop,
  triggerBottom,
  viewportTop,
  viewportHeight,
  desiredHeight,
  gap = 4,
  margin = 8,
  minHeight = 120,
}: DropdownPlacementInput): DropdownPlacement {
  const viewportBottom = viewportTop + viewportHeight;
  const spaceBelow = Math.max(0, viewportBottom - triggerBottom - gap - margin);
  const spaceAbove = Math.max(0, triggerTop - viewportTop - gap - margin);

  // Prefer opening downward (like a native select); flip only when the
  // panel doesn't fit below and there is more room above.
  const side: DropdownPlacement['side'] =
    desiredHeight <= spaceBelow || spaceBelow >= spaceAbove ? 'bottom' : 'top';
  const available = side === 'bottom' ? spaceBelow : spaceAbove;

  const floor = Math.min(minHeight, desiredHeight);
  const maxHeight = Math.round(Math.min(desiredHeight, Math.max(available, floor)));

  return { side, maxHeight, spaceBelow, spaceAbove };
}

/** Estimated panel height for the flip decision (rows are fixed-height). */
export function estimateDropdownHeight({
  optionCount,
  searchable,
  rowHeight = 36,
  listMaxHeight = 240,
  searchHeight = 50,
  padding = 8,
}: {
  optionCount: number;
  searchable: boolean;
  rowHeight?: number;
  listMaxHeight?: number;
  searchHeight?: number;
  padding?: number;
}): number {
  const list = Math.min(listMaxHeight, Math.max(1, optionCount) * rowHeight);
  return (searchable ? searchHeight : 0) + list + padding;
}
